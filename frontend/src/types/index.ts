// 사용자 정보 타입
export interface User {
  id: number;
  username: string;
  name: string;
  department: string;
  departmentId: number;
  team: string;
  teamId: number;
  role: number; // 1:일반직원, 2:팀계담당, 3:부서담당, 4:교육담당, 5:총괄담당, 6:시스템관리자
}

// 교육과정 타입
export interface Course {
  id: number;
  year: number;
  name: string;
  end_date: string;
  detail: string;
  created_by?: number;
  department_id?: number;
  department?: string;
  total_count?: number;
  submitted_count?: number;
}

// 이수 내역 타입
export interface Enrollment {
  id: number;
  user_id: number;
  course_id: number;
  state: number; // 1:미제출, 2:제출완료
  file_name?: string;
  submitted_at?: string;
  course_name?: string; // 조인해서 가져올 때 사용
  end_date?: string;
}

// 부서타입
export interface Department {
  id: number;
  name: string;
  orderIndex: number;
}

export interface Team {
  id: number;
  name: string;
  orderIndex: number;
  departmentId: number;
}

// 기능개선 의견 타입
export interface Feedback {
  id: number;
  user_id: number | null;
  user_name: string | null;
  department: string | null;
  content: string;
  checked: number;
  created_at: string;
}

// 익명 공개용 기능개선 의견 타입 (다른 사용자가 볼 수 있는 형태)
export interface PublicFeedback {
  id: number;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: number;
}
