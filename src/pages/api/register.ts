import { prisma } from "@/lib/db";
import { NextApiRequest, NextApiResponse } from "next";
import formidable, { Fields, Files } from "formidable";
import bcrypt from "bcryptjs";

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

export default async function register(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    return handlePost(req, res);
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Parse the form data
    const { fields } = await parseForm(req);

    // Extract values from arrays made by formidable
    const employeeNo = fields.employeeNo?.[0] || "";
    let password = fields.password?.[0] || "";
    const firstname = fields.Firstname?.[0] || ""; // Ensure correct casing
    const lastname = fields.lastname?.[0] || "";
    const suffix = fields.extensionName?.[0] || ""; // Adjust field name for "extensionName"
    const email = fields.email?.[0] || "";
    const positionTitle = fields.positionTitle?.[0] || "";
    const shortJobDescription = fields.shortJobDescription?.[0] || "";

    //process hashing password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    password = hashedPassword;

    // Validate required fields
    if (!employeeNo || !email || !firstname || !lastname || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save data to the database using Prisma
    const newUser = await prisma.employee.create({
      data: {
        employeeNo,
        firstname,
        email,
        lastname,
        password,
        position: positionTitle,
        shortJobDescription,
        suffix,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    return res.status(500).json({ error: "Error saving data! " + error });
  }
};
