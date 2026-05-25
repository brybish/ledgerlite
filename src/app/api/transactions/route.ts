import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/transactions
// Query params (all optional):
//   start,end        ISO dates
//   accountId        bank account filter
//   categoryId       category filter
//   filter           "uncategorized" | "income" | "expense"
//   q                full-text-ish search over description/merchant
//   minAmount,maxAmount   dollars
//   sort             "date" | "amount" (default date), dir "asc"|"desc"
//   page,pageSize    pagination (pageSize capped at 100)
export async function GET(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const sp = req.nextUrl.searchParams;

    const where: Prisma.TransactionWhereInput = { userId: u.id, deletedAt: null };

    const start = sp.get("start");
    const end = sp.get("end");
    if (start || end) where.date = { gte: start ? new Date(start) : undefined, lte: end ? new Date(end) : undefined };

    if (sp.get("accountId")) where.bankAccountId = sp.get("accountId")!;
    if (sp.get("categoryId")) where.categoryId = sp.get("categoryId")!;

    const filter = sp.get("filter");
    if (filter === "uncategorized") where.categoryId = null;
    if (filter === "income") where.amount = { gt: 0 };
    if (filter === "expense") where.amount = { lt: 0 };

    const min = sp.get("minAmount");
    const max = sp.get("maxAmount");
    if (min || max) {
      where.amount = {
        ...(typeof where.amount === "object" ? where.amount : {}),
        gte: min ? Math.round(parseFloat(min) * 100) : undefined,
        lte: max ? Math.round(parseFloat(max) * 100) : undefined,
      };
    }

    const q = sp.get("q");
    if (q) {
      where.OR = [
        { description: { contains: q, mode: "insensitive" } },
        { merchantName: { contains: q, mode: "insensitive" } },
      ];
    }

    const sort = sp.get("sort") === "amount" ? "amount" : "date";
    const dir = sp.get("dir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, splits: { include: { category: true } } },
        orderBy: { [sort]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return ok({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (err) {
    return handleError(err);
  }
}
