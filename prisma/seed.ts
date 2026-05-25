import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CHART_OF_ACCOUNTS } from "../src/server/accounting/accounts";

// ===========================================================================
// Seed / demo data. Run with: npm run db:seed
// Creates a demo LLC owner with a connected (fake) bank, a chart of accounts,
// realistic categorized transactions, a couple of rules, and manual
// assets/liabilities so every page has something to show immediately.
// Login:  demo@ledgerlite.dev  /  demopassword123
// ===========================================================================

const prisma = new PrismaClient();
const cents = (d: number) => Math.round(d * 100);

async function main() {
  await prisma.user.deleteMany({ where: { email: "demo@ledgerlite.dev" } });

  const user = await prisma.user.create({
    data: {
      email: "demo@ledgerlite.dev",
      name: "Demo Hauling LLC",
      passwordHash: await bcrypt.hash("demopassword123", 12),
      categories: { create: CHART_OF_ACCOUNTS.map((c) => ({ name: c.name, class: c.class, subgroup: c.subgroup, system: true })) },
    },
    include: { categories: true },
  });
  const cat = (name: string) => user.categories.find((c) => c.name === name)!.id;

  const institution = await prisma.institution.create({
    data: { userId: user.id, name: "Demo Bank", plaidItemId: "demo-item-1", accessTokenEnc: "demo:demo:demo" },
  });
  const checking = await prisma.bankAccount.create({
    data: { userId: user.id, institutionId: institution.id, plaidAccountId: "demo-checking", name: "Business Checking", type: "DEPOSITORY", currentBalance: cents(18250.42) },
  });
  const card = await prisma.bankAccount.create({
    data: { userId: user.id, institutionId: institution.id, plaidAccountId: "demo-card", name: "Business Card", type: "CREDIT", currentBalance: cents(2340.10) },
  });

  // A few months of categorized transactions.
  const txns = [
    { d: "2025-03-04", desc: "Client Invoice #1042", merchant: "Acme Corp", amt: 6500, c: "Revenue" },
    { d: "2025-03-09", desc: "Shell Fuel", merchant: "Shell", amt: -185.4, c: "Fuel" },
    { d: "2025-03-12", desc: "AWS", merchant: "Amazon Web Services", amt: -240.0, c: "Software" },
    { d: "2025-03-15", desc: "Office rent", merchant: "Property LLC", amt: -1800, c: "Rent" },
    { d: "2025-03-20", desc: "Client Invoice #1043", merchant: "Beta Inc", amt: 4200, c: "Revenue" },
    { d: "2025-03-28", desc: "Crew payroll", merchant: "Gusto", amt: -5200, c: "Payroll" },
    { d: "2025-04-02", desc: "Owner deposit", merchant: "Transfer", amt: 10000, c: "Owner Contributions" },
    { d: "2025-04-06", desc: "Shell Fuel", merchant: "Shell", amt: -210.5, c: "Fuel" },
    { d: "2025-04-11", desc: "Insurance premium", merchant: "Progressive", amt: -640, c: "Insurance" },
    { d: "2025-04-18", desc: "Client Invoice #1051", merchant: "Acme Corp", amt: 7300, c: "Revenue" },
    { d: "2025-04-25", desc: "Equipment repair", merchant: "Joe's Diesel", amt: -980, c: "Repairs & Maintenance" },
    { d: "2025-05-01", desc: "Uncategorized purchase", merchant: "Home Depot", amt: -312.77, c: null },
  ];
  for (const t of txns) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        bankAccountId: t.amt < 0 && Math.random() > 0.6 ? card.id : checking.id,
        plaidTransactionId: `demo-${t.d}-${t.merchant}`,
        date: new Date(t.d),
        description: t.desc,
        merchantName: t.merchant,
        amount: cents(t.amt),
        type: t.amt < 0 ? "DEBIT" : "CREDIT",
        accountName: "Business Checking",
        institutionName: "Demo Bank",
        categoryId: t.c ? cat(t.c) : null,
      },
    });
  }

  await prisma.categorizationRule.createMany({
    data: [
      { userId: user.id, name: "Shell → Fuel", field: "MERCHANT", op: "CONTAINS", value: "Shell", categoryId: cat("Fuel"), priority: 10 },
      { userId: user.id, name: "AWS → Software", field: "MERCHANT", op: "CONTAINS", value: "Amazon Web Services", categoryId: cat("Software"), priority: 20 },
    ],
  });

  await prisma.asset.createMany({
    data: [
      { userId: user.id, name: "2019 Freightliner Truck", type: "Vehicles", value: cents(82000), depreciable: true, usefulLifeMonths: 84, acquisitionDate: new Date("2022-01-01") },
      { userId: user.id, name: "Skid Steer Loader", type: "Equipment", value: cents(38000), depreciable: true, usefulLifeMonths: 60 },
    ],
  });
  await prisma.liability.createMany({
    data: [
      { userId: user.id, name: "Equipment Loan", type: "Loans Payable", balance: cents(45000), longTerm: true, interestRate: 6.5 },
      { userId: user.id, name: "Business Line of Credit", type: "Credit Cards", balance: cents(2340.1), longTerm: false },
    ],
  });

  console.log("Seeded demo user: demo@ledgerlite.dev / demopassword123");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
