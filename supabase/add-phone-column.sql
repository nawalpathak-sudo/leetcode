-- Add phone column to students table for WhatsApp OTP auth
ALTER TABLE students ADD COLUMN phone TEXT UNIQUE;
CREATE INDEX idx_students_phone ON students(phone);
