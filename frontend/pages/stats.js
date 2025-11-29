// frontend/pages/stats.js
import { useEffect, useState } from "react";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import Layout from "../components/Layout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Stats() {
  const [data, setData] = useState([]);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const client = new ApolloClient({
      uri: "http://localhost:4000/graphql",
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
        const arr = res.data.occurrences.map((o) => ({ number: o.number, count: o.count }));
        setData(arr);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [isPremium]);

  return (
    <Layout>
      <h2>Statistiques — Occurrence des numéros</h2>
      <button onClick={() => setIsPremium((p) => !p)}>{isPremium ? "Voir gratuit" : "Simuler Premium"}</button>
      <div style={{ marginTop: 20 }}>
        <BarChart width={900} height={400} data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="number" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </div>
    </Layout>
  );
}
