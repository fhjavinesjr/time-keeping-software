import { prisma } from "@/lib/db";
import { NextApiRequest, NextApiResponse } from "next";
import formidable, { Fields, Files } from "formidable";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serialize } from "cookie";

const SECRET_KEY = process.env.JWT_SECRET_KEY;

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

export default function loginAuthentication(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    return handlePost(req, res);
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {

  const { fields } = await parseForm(req);

  const employeeNo = fields.employeeNo?.[0] || "";
  const password = fields.password?.[0] || "";

  try {
    // Query the employee using the employeeNo
    const employee = await prisma.employee.findUnique({
      where: { employeeNo: employeeNo}, // Using `employeeNo` to find the employee
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Compare the hashed password with the plain text password
    const isPasswordCorrect = await bcrypt.compare(password as string, employee.password);

    if (isPasswordCorrect) {
      // Password is correct, proceed with login (e.g., create a session or token)

      // Create a token with user data
      const token = jwt.sign({ employeeNo: employee.employeeNo as string }, SECRET_KEY as string, { expiresIn: "1h" });

      // Set the token as a cookie
      res.setHeader("Set-Cookie", serialize("token", token, {
          httpOnly: true, // Protect the cookie from client-side scripts
          secure: process.env.NODE_ENV === "production", // Use HTTPS in production
          maxAge: 3600, // 1 hour
          path: "/", // Cookie is accessible on the entire site
        })
      );

      return res.status(200).json({ message: "Login successful" });
    } else {
      // Incorrect password
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error fetching employee:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
