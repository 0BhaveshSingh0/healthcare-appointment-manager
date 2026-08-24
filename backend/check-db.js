require('dotenv').config();
const prisma = require('./src/db/prisma');
async function main() {
  const forms = await prisma.symptomForm.findMany({ orderBy: { createdAt: 'desc' }, take: 1 });
  console.log(JSON.stringify(forms, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
