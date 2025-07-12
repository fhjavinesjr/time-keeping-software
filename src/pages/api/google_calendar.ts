import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const calendarId = 'en.philippines#holiday@group.v.calendar.google.com'; 
  
    const apiKey = process.env.GOOGLE_API_KEY; // Use an environment variable for security 
  
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent( 
  
      calendarId 
  
    )}/events?key=${apiKey}`; 
  
    try { 
  
      const response = await fetch(url); 
  
      if (!response.ok) { 
  
        throw new Error(`Error fetching calendar: ${response.statusText}`); 
  
      } 
  
      const data = await response.json(); 
  
      res.status(200).json(data); 
  
    } catch (error) { 
  
      console.error(error); 
  
      res.status(500).json({ error: 'Failed to fetch calendar events' }); 
  
    } 
  
  }