"use client";

import { useEffect, useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function StatsPage() {
  const [data, setData] = useState([]);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const client = new ApolloClient({
      link: new HttpLink({
        uri: "http://localhost:4000/graphql",
      }),
      cache: new InMemoryCache(),
    });

    client
      .query({
        query: gql`
          query ($premium: Boolean) {
            occurrences(premium: $premium) {
              number
              count
            }
          }
        `,
        variables: { premium: isPremium },
      })
      .then((res) => {
        setData(
          res.data.occurrences.map((o) => ({
            number: o.number,
            count: o.count,
          }))
        );
      })
      .catch(console.error);
  }, [isPremium]);

  return (
    <div style={{ padding: "40px" }}>
      <h1>📊 Statistiques des numéros</h1>

      <button
        onClick={() => setIsPremium(!isPremium)}
        style={{
          margin: "20px 0",
          padding: "10px 20px",
          background: isPremium ? "#444" : "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "8px",
        }}
      >
        {isPremium ? "Mode Premium (ON)" : "Mode Gratuit"}
      </button>

      <BarChart width={900} height={400} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="number" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" />
      </BarChart>
    </div>
  );
}
