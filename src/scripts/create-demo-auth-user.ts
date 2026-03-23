/**
 * Creates the demo auth user in Supabase Auth.
 * Run with: npx tsx src/scripts/create-demo-auth-user.ts
 *
 * This fixes the login issue where the users table has the demo user
 * but Supabase Auth does not have the corresponding auth user.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_USER_ID = '86a3ccb9-b8e5-4320-8660-a1ebfa258ff9'
const DEMO_EMAIL = 'demo@getsear.com'
const DEMO_PASSWORD = 'demo1234'

async function main() {
  console.log('Creating demo auth user...')

  // First check if user already exists
  const { data: existingUser } = await supabase.auth.admin.getUserById(DEMO_USER_ID)

  if (existingUser?.user) {
    console.log('Auth user already exists. Updating password...')
    const { error } = await supabase.auth.admin.updateUserById(DEMO_USER_ID, {
      password: DEMO_PASSWORD,
      email: DEMO_EMAIL,
      email_confirm: true,
    })
    if (error) {
      console.error('Failed to update user:', error.message)
      process.exit(1)
    }
    console.log('✓ Password updated for demo@getsear.com')
    return
  }

  // Create the auth user with the specific ID
  const { data, error } = await supabase.auth.admin.createUser({
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: 'Marcus R.',
      role: 'owner',
    },
  })

  if (error) {
    console.error('Failed to create auth user:', error.message)

    // If ID conflict, try deleting and recreating
    if (error.message.includes('already') || error.message.includes('duplicate')) {
      console.log('Attempting to delete existing and recreate...')
      await supabase.auth.admin.deleteUser(DEMO_USER_ID)
      const { error: retryError } = await supabase.auth.admin.createUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: 'Marcus R.', role: 'owner' },
      })
      if (retryError) {
        console.error('Retry failed:', retryError.message)
        process.exit(1)
      }
      console.log('✓ Recreated auth user successfully')
      return
    }

    process.exit(1)
  }

  console.log('✓ Created auth user:', data.user.id)
  console.log('  Email:', DEMO_EMAIL)
  console.log('  Password:', DEMO_PASSWORD)
  console.log('')
  console.log('You can now log in at https://getsear.com/login')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
