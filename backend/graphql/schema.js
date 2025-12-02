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
    num6: Int
    bonus: Int
    premium: Boolean
  }

  type Occurrence {
    number: Int
    count: Int
  }

  type Probabilite {
    probabilite: Float
  }

  type Admin {
    id: ID!
    username: String!
  }

  type AuthPayload {
    token: String!
    admin: Admin!
  }

  type Query {
    tirages(limit: Int!, offset: Int, premium: Boolean!, date: String, year: Int, month: Int): [Tirage!]!

    occurrences(premium: Boolean): [Occurrence]
    admins: [Admin!]!
    availableDates(premium: Boolean): [String!]!
  }

  type Mutation {
    calculerProbabilite(numeros: [Int]!, premium: Boolean): Probabilite

    createAdmin(username: String!, password: String!): Admin!
    loginAdmin(username: String!, password: String!): AuthPayload!
  }
`;

module.exports = { typeDefs };
