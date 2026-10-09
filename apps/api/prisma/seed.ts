import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Idempotent: safe to run any number of times.
  const goldType = await prisma.goldType.upsert({
    where: { code: 'NT_9999' },
    update: {
      name: 'Nhẫn trơn 9999 Ngọc Thịnh',
      sourceLabel: 'Vàng 9999 (nhẫn tròn)',
      sourceUrl: 'https://ngocthinh-jewelry.vn/',
    },
    create: {
      code: 'NT_9999',
      name: 'Nhẫn trơn 9999 Ngọc Thịnh',
      sourceLabel: 'Vàng 9999 (nhẫn tròn)',
      sourceUrl: 'https://ngocthinh-jewelry.vn/',
      isActive: true,
    },
  });
  console.log(`Seeded gold type ${goldType.code} (${goldType.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
