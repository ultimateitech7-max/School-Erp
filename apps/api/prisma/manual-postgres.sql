CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_current_per_school
ON sessions (school_id)
WHERE is_current = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_guardians_primary
ON student_guardians (student_id)
WHERE is_primary = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admissions_roll_no
ON admissions (school_id, session_id, section_id, roll_no)
WHERE roll_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_assignments_active
ON transport_assignments (school_id, session_id, student_id)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_students_full_name_trgm
ON students
USING GIN (LOWER(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_teachers_full_name_trgm
ON teachers
USING GIN (LOWER(full_name) gin_trgm_ops);
