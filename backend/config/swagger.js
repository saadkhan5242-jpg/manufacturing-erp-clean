import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Manufacturing ERP Core System API",
    version: "1.0.0",
    description: "Enterprise Grade Shop Floor, MRP, Inventory, Billing, and AI Service Operations API",
    contact: {
      name: "Global Shop ERP Operations Team",
      email: "support@global-shop-erp.local"
    }
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local Development Server"
    },
    {
      url: "https://api.global-shop-erp.example.com",
      description: "Cloud Production Environment"
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      SupervisorPinHeader: {
        type: "apiKey",
        in: "header",
        name: "x-supervisor-pin"
      }
    }
  },
  security: [{ BearerAuth: [] }]
};

const options = {
  swaggerDefinition,
  apis: ["./routes/*.js", "./ai/*.js", "./server.js"]
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
