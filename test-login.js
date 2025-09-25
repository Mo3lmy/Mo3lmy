const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testLogin(email, plainPassword) {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return;
    }

    console.log(`\nFound user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Stored password hash: ${user.password.substring(0, 20)}...`);
    console.log(`Testing password: "${plainPassword}"`);

    // Test password
    const isValid = await bcrypt.compare(plainPassword, user.password);
    console.log(`Password valid: ${isValid}`);

    if (!isValid) {
      // Try some common passwords to debug
      const testPasswords = ['password', 'Password123', 'password123', 'test123', '123456'];
      console.log('\nTrying common passwords to debug:');
      for (const testPw of testPasswords) {
        const result = await bcrypt.compare(testPw, user.password);
        if (result) {
          console.log(`✓ Actual password is: "${testPw}"`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Test with the first user
testLogin('test@test.com', 'password');