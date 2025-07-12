import { prisma } from "@/lib/db";
import { NextApiRequest, NextApiResponse } from 'next';
 
export default async function fetchEmployeeDetail(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const employees = await prisma.employee.findMany();
      res.status(200).json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}