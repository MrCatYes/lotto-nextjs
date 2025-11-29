const { gql } = require("apollo-server-express");

const typeDefs = gql`
  type Tirage {
    id: ID!
    date: String
    num1: Int
    num2: Int
    num3: Int
    num4: Int
    num5: Int
    bonus: Int
    premium: Boolean
  }

  type Probabilite {
    probabilite: Float
  }

  type Query {
    tirages(limit: Int, premium: Boolean): [Tirage]
  }

  type Mutation {
    calculerProbabilite(numeros: [Int]!, premium: Boolean): Probabilite
  }
`;

module.exports = { typeDefs };
