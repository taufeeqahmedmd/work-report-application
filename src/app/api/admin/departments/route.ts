import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { 
  getAllDepartments, 
  createDepartment, 
} from '@/lib/db/queries';
import type { ApiResponse, Department, CreateDepartmentInput } from '@/types';

// GET: Get all departments (admin only — exposes the full org list)
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.role !== 'admin' && session.role !== 'superadmin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const departments = await getAllDepartments();

    // Add caching headers - departments change infrequently but admins need to see new ones
    const response = NextResponse.json<ApiResponse<Department[]>>({
      success: true,
      data: departments,
    });
    
    // Cache for 1 minute - short enough for admin operations, long enough for performance
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    
    return response;
  } catch (error) {
    logger.error('Get departments error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST: Create a new department (superadmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only superadmins can create departments' },
        { status: 403 }
      );
    }

    const body: CreateDepartmentInput = await request.json();
    const { name, entityId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Department name is required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Entity is required' },
        { status: 400 }
      );
    }

    // Check if department already exists in this entity
    const allDepartments = await getAllDepartments();
    const existing = allDepartments.find(
      d => d.name.toLowerCase() === name.trim().toLowerCase() && d.entityId === entityId
    );
    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Department already exists in this entity' },
        { status: 409 }
      );
    }

    const department = await createDepartment({ name: name.trim(), entityId });

    return NextResponse.json<ApiResponse<Department>>({
      success: true,
      data: department,
      message: 'Department created successfully',
    }, { status: 201 });
  } catch (error) {
    logger.error('Create department error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
