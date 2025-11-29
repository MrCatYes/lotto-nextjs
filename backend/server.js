const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const cors = require("cors");
const { typeDefs } = require("./graphql/schema");
const { resolvers } = require("./graphql/resolvers");

const app = express();
app.use(cors());
app.use(express.json());

const server = new ApolloServer({ typeDefs, resolvers });
server.start().then(() => {
    server.applyMiddleware({ app });
    app.listen(4000, () => console.log("Backend running on http://localhost:4000/graphql"));
});
