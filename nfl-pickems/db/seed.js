// Database seed script
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Hash admin password
    const SALT_ROUNDS = 10;
    const adminPasswordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'ChangeMe123!',
      SALT_ROUNDS
    );

    // Insert admin user
    const adminResult = await client.query(
      `INSERT INTO users (username, display_name, password_hash, timezone, primary_color, secondary_color, is_admin, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [
        process.env.ADMIN_USERNAME || 'admin',
        process.env.ADMIN_DISPLAY_NAME || 'Administrator',
        adminPasswordHash,
        process.env.ADMIN_TIMEZONE || 'America/New_York',
        process.env.ADMIN_PRIMARY_COLOR || '#8AB4F8',
        process.env.ADMIN_SECONDARY_COLOR || '#5E97F6'
      ]
    );

    if (adminResult.rows.length > 0) {
      console.log('✅ Admin user created:', process.env.ADMIN_USERNAME);
      const adminId = adminResult.rows[0].id;

      // Create default league
      const leagueResult = await client.query(
        `INSERT INTO leagues (name, season_year, mode, created_by)
         VALUES ($1, $2, 'standard', $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        ['Main League', parseInt(process.env.CURRENT_SEASON) || 2025, adminId]
      );

      if (leagueResult.rows.length > 0) {
        console.log('✅ Default league created: Main League');
        
        // Add admin to league
        await client.query(
          `INSERT INTO league_members (league_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [leagueResult.rows[0].id, adminId]
        );
        console.log('✅ Admin added to Main League');
      }
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\nYou can now login with:');
    console.log(`Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();