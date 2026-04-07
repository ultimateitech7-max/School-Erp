const BASE_URL = process.env.API_URL || 'http://localhost:4000/api/v1';
const LOGIN_EMAIL = 'admin@school.com';
const LOGIN_PASSWORD = '12345678';

type HeadersMap = Record<string, string>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
}

interface RequestResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  durationMs: number;
  error?: string;
}

interface LoginResponse {
  accessToken: string;
  user?: {
    id: string;
    email: string;
    role: string;
    schoolId: string | null;
  };
}

interface StudentRecord {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  class?: {
    id: string;
    name: string;
  } | null;
  section?: {
    id: string;
    name: string;
  } | null;
}

interface StudentsListResponse {
  success: boolean;
  data: StudentRecord[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StepState {
  token: string | null;
  createdStudentId: string | null;
}

async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<RequestResult<T>> {
  const startedAt = Date.now();
  const headers: HeadersMap = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    const data = text ? safeJsonParse(text) : null;

    return {
      ok: response.ok,
      status: response.status,
      data: data as T | null,
      durationMs,
      error:
        response.ok
          ? undefined
          : extractErrorMessage(data) || `Request failed with status ${response.status}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown request error';

    return {
      ok: false,
      status: 0,
      data: null,
      durationMs: Date.now() - startedAt,
      error: /fetch failed/i.test(message)
        ? `Backend not reachable at ${BASE_URL}. Start the API server and try again.`
        : message,
    };
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload) {
    return undefined;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object' && payload !== null) {
    const maybeMessage = (payload as Record<string, unknown>).message;

    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }

    if (Array.isArray(maybeMessage)) {
      return maybeMessage.join(', ');
    }
  }

  return undefined;
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printResult<T>(title: string, result: RequestResult<T>) {
  printSection(title);
  console.log(result.ok ? 'SUCCESS' : 'FAIL');
  console.log(`STATUS: ${result.status || 'N/A'}`);
  console.log(`TIME: ${result.durationMs}ms`);

  if (result.error) {
    console.log(`ERROR: ${result.error}`);
  }

  console.log('RESPONSE:');
  console.log(JSON.stringify(result.data, null, 2));
}

async function runStep<T>(
  title: string,
  action: () => Promise<RequestResult<T>>,
  onSuccess?: (result: RequestResult<T>) => void,
) {
  try {
    const result = await action();
    printResult(title, result);

    if (result.ok && onSuccess) {
      onSuccess(result);
    }
  } catch (error) {
    printSection(title);
    console.log('FAIL');
    console.log(`ERROR: ${error instanceof Error ? error.message : 'Unknown step error'}`);
  }
}

function buildRequestedStudentPayload() {
  return {
    name: 'Auto Test Student',
    email: 'auto@test.com',
    phone: '9999999999',
    class: '10',
    section: 'A',
  };
}

function buildCompatibleStudentPayload() {
  const suffix = Date.now();

  return {
    studentCode: `AUTO-${suffix}`,
    name: 'Auto Test Student',
    email: `auto+${suffix}@test.com`,
    phone: '9999999999',
    gender: 'MALE',
    dateOfBirth: '2010-01-01',
  };
}

async function login(state: StepState) {
  await runStep<LoginResponse>('LOGIN', async () => {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: {
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
      },
    });
  }, (result) => {
    state.token = result.data?.accessToken ?? null;
  });
}

async function testUsers(state: StepState) {
  await runStep('USERS', async () => {
    if (!state.token) {
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs: 0,
        error: 'Missing access token.',
      };
    }

    return apiRequest('/users', {
      method: 'GET',
      token: state.token,
    });
  });
}

async function createStudent(state: StepState) {
  await runStep<StudentRecord | { success: boolean; data: StudentRecord }>(
    'STUDENTS CREATE',
    async () => {
      if (!state.token) {
        return {
          ok: false,
          status: 0,
          data: null,
          durationMs: 0,
          error: 'Missing access token.',
        };
      }

      const requestedAttempt = await apiRequest('/students', {
        method: 'POST',
        token: state.token,
        body: buildRequestedStudentPayload(),
      });

      if (requestedAttempt.ok) {
        return requestedAttempt;
      }

      const compatibleAttempt = await apiRequest('/students', {
        method: 'POST',
        token: state.token,
        body: buildCompatibleStudentPayload(),
      });

      if (compatibleAttempt.ok) {
        return compatibleAttempt;
      }

      return {
        ...compatibleAttempt,
        data: {
          requestedAttempt: requestedAttempt.data,
          compatibleAttempt: compatibleAttempt.data,
        } as unknown as StudentRecord,
        error:
          compatibleAttempt.error || requestedAttempt.error || 'Student creation failed.',
      };
    },
    (result) => {
      const payload = result.data as
        | { success?: boolean; data?: StudentRecord }
        | StudentRecord
        | null;

      const student =
        payload && 'data' in payload ? payload.data : payload;

      state.createdStudentId = student?.id ?? null;
    },
  );
}

async function listStudents(state: StepState) {
  await runStep<StudentsListResponse>('STUDENTS LIST', async () => {
    if (!state.token) {
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs: 0,
        error: 'Missing access token.',
      };
    }

    return apiRequest<StudentsListResponse>('/students?page=1&limit=10&search=Auto', {
      method: 'GET',
      token: state.token,
    });
  });
}

async function getSingleStudent(state: StepState) {
  await runStep('STUDENT SINGLE', async () => {
    if (!state.token) {
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs: 0,
        error: 'Missing access token.',
      };
    }

    if (!state.createdStudentId) {
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs: 0,
        error: 'No student id available from create step.',
      };
    }

    return apiRequest(`/students/${state.createdStudentId}`, {
      method: 'GET',
      token: state.token,
    });
  });
}

async function main() {
  console.log(`BASE_URL: ${BASE_URL}`);

  const state: StepState = {
    token: null,
    createdStudentId: null,
  };

  await login(state);
  await testUsers(state);
  await createStudent(state);
  await listStudents(state);
  await getSingleStudent(state);
}

void main().catch((error) => {
  console.error('\n=== SYSTEM TEST SCRIPT FAILED ===');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
