import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, isAdmin } from '@/lib/auth';
import { createEmployee, getEmployeeByEmployeeId, getEmployeeByEmail } from '@/lib/db/queries';
import type { ApiResponse, CreateEmployeeInput } from '@/types';

interface BulkUploadResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; employeeId: string; error: string }>;
}

// POST: Bulk upload users from CSV data
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !isAdmin(session)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { users } = body as { users: CreateEmployeeInput[] };

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No users provided' },
        { status: 400 }
      );
    }

    const result: BulkUploadResult = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!user.employeeId || !user.name || !user.email || !user.department || !user.password) {
          result.failed++;
          result.errors.push({
            row: rowNum,
            employeeId: user.employeeId || 'Unknown',
            error: 'Missing required fields',
          });
          continue;
        }

        // Check if employee ID already exists
        const existingById = await getEmployeeByEmployeeId(user.employeeId);
        if (existingById) {
          result.failed++;
          result.errors.push({
            row: rowNum,
            employeeId: user.employeeId,
            error: 'Employee ID already exists',
          });
          continue;
        }

        // Check if email already exists
        const existingByEmail = await getEmployeeByEmail(user.email);
        if (existingByEmail) {
          result.failed++;
          result.errors.push({
            row: rowNum,
            employeeId: user.employeeId,
            error: 'Email already exists',
          });
          continue;
        }

        // Admin can only create in their entity/branch
        if (session.role === 'admin') {
          if (user.entityId && user.entityId !== session.entityId) {
            result.failed++;
            result.errors.push({
              row: rowNum,
              employeeId: user.employeeId,
              error: 'Cannot create user in different entity',
            });
            continue;
          }
          if (user.branchId && user.branchId !== session.branchId) {
            result.failed++;
            result.errors.push({
              row: rowNum,
              employeeId: user.employeeId,
              error: 'Cannot create user in different branch',
            });
            continue;
          }
        }

        // Hash password
        const hashedPassword = await hashPassword(user.password);

        // Create user
        await createEmployee({
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          department: user.department,
          password: hashedPassword,
          entityId: user.entityId ?? (session.role === 'admin' ? session.entityId : null),
          branchId: user.branchId ?? (session.role === 'admin' ? session.branchId : null),
          role: user.role ?? 'employee',
          createdBy: session.id,
        });

        result.successful++;
      } catch (error) {
        result.failed++;
        console.error(`[BULK_UPLOAD] Row ${rowNum} error:`, error);
        result.errors.push({
          row: rowNum,
          employeeId: user.employeeId || 'Unknown',
          error: 'Failed to create employee',
        });
      }
    }

    return NextResponse.json<ApiResponse<BulkUploadResult>>({
      success: true,
      data: result,
      message: `Bulk upload completed: ${result.successful} succeeded, ${result.failed} failed`,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to process bulk upload' },
      { status: 500 }
    );
  }
}
