import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfwqcbepdbfariuuxks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZndxY2JlcGRiZmFyaXV1eGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTc2NDksImV4cCI6MjA3Njk3MzY0OX0.Pigp35_6m-4rc7sZMXCESyKF3pIZ2L2vd2wu8q6Sx9M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);