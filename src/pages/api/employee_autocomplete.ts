import { prisma } from "@/lib/db";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query; // "query" is the search term
  const searchQuery = Array.isArray(query) ? query[0] : query;


  if (!searchQuery || searchQuery.trim() === "") {
    return res.status(400).json({ error: "Query parameter is required." });
  }

  try {
    const employees = await prisma.employee.findMany({
        where: {
          OR: [
            {
              lastname: {
                contains: searchQuery,
              },
            },
            {
              employeeNo: {
                contains: searchQuery,
              },
            },
          ],
        },
        select: {
          employeeid: true,
          lastname: true,
          firstname: true,
          suffix: true,
          employeeNo: true,
        },
        orderBy: {
            lastname: 'asc',
        },
        take: 10, // Limit results for performance
    });

    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
