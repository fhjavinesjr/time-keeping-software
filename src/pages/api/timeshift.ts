import { prisma } from "@/lib/db";
import { NextApiRequest, NextApiResponse } from "next";
import formidable, { Fields, Files } from "formidable";

// Disable body parser
export const config = {
    api: {
      bodyParser: false,
    },
};

// Helper to parse form data as a Promise
const parseForm = (req: NextApiRequest): Promise<{ fields: Fields; files: Files }> => {
  const form = formidable();
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
};

export default async function createTimeShift(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    return handlePost(req, res);
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    try {
        
        // Parse the form data
        const { fields } = await parseForm(req);

        // Extract values from arrays made by formidable
        const dateFrom = fields.dateFrom?.[0] || "";
        const dateTo = fields.dateTo?.[0] || "";
        const timeIn = fields.timeIn?.[0] || "";
        const breakOut = fields.breakOut?.[0] || "";
        const breakIn = fields.breakIn?.[0] || "";
        const timeOut = fields.timeOut?.[0] || "";
        const monRestDay = fields.Monday?.[0] || "";
        const tueRestDay = fields.Tuesday?.[0] || "";
        const wedRestDay = fields.Wednesday?.[0] || "";
        const thursRestDay = fields.Thursday?.[0] || "";
        const friRestDay = fields.Friday?.[0] || "";
        const satRestDay = fields.Saturday?.[0] || "";
        const sunRestDay = fields.Sunday?.[0] || "";
        const applyToAll = fields.applyToAll?.[0] || "";
        const employeeFieldTimeShift = fields.employeeFieldTimeShift?.[0] || "";

        // Validate required fields
        if (!dateFrom || !dateTo || !timeIn || !breakOut || !breakIn || !timeOut) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if(!applyToAll) { //check if the apply to all is unchecked
          if(!employeeFieldTimeShift) {
            return res.status(400).json({ error: "Missing required fields" });
          }
        }

        // Save data to the database using Prisma
        const newData = await prisma.timeshift.create({
            data: {
              dateFrom,
              dateTo,
              timeIn,
              breakOut,
              breakIn,
              timeOut,
              monRestDay,
              tueRestDay,
              wedRestDay,
              thursRestDay,
              friRestDay,
              satRestDay,
              sunRestDay,
              applyToAll,
              employeeFieldTimeShift,
            },
        });

        return res.status(201).json({ success: true, data: newData });
    } catch (error) {
        return res.status(500).json({ error: "Error saving data! " + error });
    }
}

// reference for the future use
// const employeeWithShifts = await prisma.employee.findUnique({
//     where: { employeeid: 1 },
//     include: { timeshift: true },
//   });
// const timeShiftWithAuthor = await prisma.timeShift.findUnique({
//     where: { timeshiftid: 1 },
//     include: { author: true },
//   });
  