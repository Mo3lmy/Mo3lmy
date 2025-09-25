const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword(email, newPassword) {
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    console.log(`✅ Password reset for user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   New password: ${newPassword}`);

    // Test the new password
    const updatedUser = await prisma.user.findUnique({
      where: { email }
    });

    const isValid = await bcrypt.compare(newPassword, updatedUser.password);
    console.log(`   Password verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);

  } catch (error) {
    console.error('Error resetting password:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Reset password for test@test.com
resetPassword('test@test.com', 'Password123!');