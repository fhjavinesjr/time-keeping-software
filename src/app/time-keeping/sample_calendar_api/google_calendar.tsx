'use client'

import { useEffect, useState } from 'react';

interface Event {
  id: string;
  start: {
    date?: string;
    dateTime?: string;
  };
  summary: string;
}

interface ApiResponse {
  items: Event[];
}

export default function Holidays() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const calendarId = 'en.philippines#holiday@group.v.calendar.google.com';
      const apiKey = "AIzaSyAkAOfZtoI1KxDmj52_tsBsRO6qSET2vTg"; // Replace with your API key

      const now = new Date();
      const year = now.getFullYear();
      const timeMin = new Date(year, 0, 1).toISOString(); // January 1st of the current year
      const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString(); // December 31st of the current year

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}`;

      try {
        const response = await fetch(url);
        const data: ApiResponse = await response.json();

        // Sort events by start date in ascending order
        const sortedEvents = (data.items || []).sort((a, b) => {
          const dateA = new Date(a.start.date || a.start.dateTime || '').getTime();
          const dateB = new Date(b.start.date || b.start.dateTime || '').getTime();
          return dateA - dateB;
        });

        setEvents(sortedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const calendarStartIndex = 1;

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Philippines Holidays for {new Date().getFullYear()}</h1>
      {events.length === 0 ? (
        <p>No holidays found.</p>
      ) : (
        <ul>
          {events.slice(calendarStartIndex).map((event) => (
            <li key={event.id}>
              {event.start?.date || event.start?.dateTime || 'No Date'} - {event.summary || 'No Summary'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}