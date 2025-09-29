import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect } from 'react';

// Dynamically import Swagger UI to avoid server-side rendering issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <p>Loading API documentation...</p>,
});

export default function SwaggerUIComponent() {
  // The swagger spec in JSON format
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "E-commerce API",
      description: "API documentation",
      version: "1.0.0",
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
        description: "Current server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        }
      }
    },
    paths: {
      "/api/health": {
        get: {
          summary: "Check API health",
          responses: {
            200: {
              description: "Health check response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/users/createUser": {
        post: {
          summary: "Create user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["firstName", "lastName", "emailId", "password"],
                  properties: {
                    firstName: { type: "string", example: "John" },
                    lastName: { type: "string", example: "Doe" },
                    emailId: { type: "string", example: "john.doe@example.com" },
                    password: { type: "string", example: "Password123" }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Created user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" },
                          firstName: { type: "string", example: "John" },
                          lastName: { type: "string", example: "Doe" },
                          emailId: { type: "string", example: "john.doe@example.com" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/users/signIn": {
        post: {
          summary: "Sign in with email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["emailId", "password"],
                  properties: {
                    emailId: { type: "string", example: "john.doe@example.com" },
                    password: { type: "string", example: "Password123" }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Signed-in user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" },
                          firstName: { type: "string", example: "John" },
                          lastName: { type: "string", example: "Doe" },
                          emailId: { type: "string", example: "john.doe@example.com" }
                        }
                      },
                      token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..." }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/users/signOut": {
        post: {
          summary: "Sign out current session",
          responses: {
            200: {
              description: "Sign-out result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Signed out successfully" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/users": {
        get: {
          summary: "Fetch all users",
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: "List of users",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string", example: "1" },
                            created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" },
                            firstName: { type: "string", example: "John" },
                            lastName: { type: "string", example: "Doe" },
                            emailId: { type: "string", example: "john.doe@example.com" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/users/{userId}": {
        get: {
          summary: "Fetch a user by id",
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              description: "User id as BigInt string",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "User record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" },
                          firstName: { type: "string", example: "John" },
                          lastName: { type: "string", example: "Doe" },
                          emailId: { type: "string", example: "john.doe@example.com" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/gender": {
        get: {
          summary: "Fetch all genders",
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: "List of genders",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      genders: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "number", example: 1 },
                            name: { type: "string", example: "Male" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/preferred-department": {
        post: {
          summary: "Set preferred department by gender selection",
          security: [
            {
              bearerAuth: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId", "genderId"],
                  properties: {
                    userId: { type: "number", example: 15 },
                    genderId: { type: "number", example: 2 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Stored preference",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      preference: {
                        type: "object",
                        properties: {
                          id: { type: "number", example: 1 },
                          userId: { type: "number", example: 15 },
                          genderId: { type: "number", example: 2 },
                          isActive: { type: "number", example: 1 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/preferred-department/{userId}": {
        get: {
          summary: "Fetch latest preferred department for a user",
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              description: "User id as BigInt string",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Latest preference",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      preference: {
                        type: "object",
                        properties: {
                          id: { type: "number", example: 1 },
                          userId: { type: "number", example: 15 },
                          genderId: { type: "number", example: 2 },
                          isActive: { type: "number", example: 1 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        put: {
          summary: "Deactivate active preferred department for a user",
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              description: "User id as BigInt string",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Success message",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "The gender has been removed successfully" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // Apply the CSS fixes after Swagger UI is loaded
  useEffect(() => {
    // Wait for DOM to be ready and then apply styles
    const applyStyles = () => {
      const style = document.createElement('style');
      style.innerHTML = `
        .swagger-ui .opblock-summary-path {
          display: inline-block !important;
          white-space: nowrap !important;
          min-width: 150px !important;
        }
        .swagger-ui .opblock-summary-path--deprecated {
          display: inline-block !important;
          white-space: nowrap !important;
        }
        .swagger-ui .opblock-summary {
          display: flex !important;
          align-items: center !important;
          flex-direction: row !important;
        }
        .swagger-ui .opblock-summary-method {
          margin-right: 15px !important;
        }
        .swagger-ui .opblock-summary-description {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .swagger-ui .opblock .opblock-summary-path__deprecated {
          display: inline !important;
          white-space: nowrap !important;
        }
      `;
      document.head.appendChild(style);
    };

    // Apply styles after a delay to ensure Swagger UI has loaded
    const timer = setTimeout(applyStyles, 1000);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Head>
        <title>API Documentation</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
      </Head>
      <SwaggerUI spec={spec} />
    </>
  );
}