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
      },
      "/api/v1/users/physical-stats": {
        post: {
          summary: "Store user physical stats (height and weight)",
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
                  required: ["heightUnit", "weightUnit", "heightValue", "weightValue"],
                  properties: {
                    heightUnit: { type: "string", enum: ["cm", "ft"], example: "cm" },
                    weightUnit: { type: "string", enum: ["kg", "lb"], example: "kg" },
                    heightValue: { type: "number", example: 175.5 },
                    weightValue: { type: "number", example: 70.2 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Physical stats stored successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      stats: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          userId: { type: "string", example: "15" },
                          heightCm: { type: "number", example: 175.5 },
                          heightFt: { type: "number", example: null },
                          weightKg: { type: "number", example: 70.2 },
                          weightLb: { type: "number", example: null },
                          created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        get: {
          summary: "Fetch latest physical stats for the authenticated user",
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: "Latest physical stats",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      stats: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          userId: { type: "string", example: "15" },
                          heightCm: { type: "number", example: 175.5 },
                          heightFt: { type: "number", example: null },
                          weightKg: { type: "number", example: 70.2 },
                          weightLb: { type: "number", example: null },
                          created_at: { type: "string", example: "2025-09-27T12:34:56.789Z" }
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
      "/api/v1/age-group": {
        get: {
          summary: "Fetch all available age groups",
          description: "Returns a list of all age groups (18-20, 21-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65+)",
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: "List of age groups",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ageGroups: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string", example: "1" },
                            ageRange: { type: "string", example: "25-29" },
                            minAge: { type: "number", example: 25, nullable: true },
                            maxAge: { type: "number", example: 29, nullable: true },
                            created_at: { type: "string", example: "2025-10-02T12:34:56.789Z" },
                            updated_at: { type: "string", example: null, nullable: true }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: "Unauthorized - Invalid or missing JWT token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Unauthorized" }
                    }
                  }
                }
              }
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Internal server error" },
                      details: { type: "string", example: "An unexpected error occurred" }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: "Save user's age group preference",
          description: "Allows a user to select their age group. If the user already has an active age group, it will be deactivated before saving the new one.",
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
                  required: ["userId", "ageGroupId"],
                  properties: {
                    userId: { 
                      type: "string", 
                      example: "15",
                      description: "The ID of the user" 
                    },
                    ageGroupId: { 
                      type: "string", 
                      example: "3",
                      description: "The ID of the age group to save" 
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Age group saved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      userAgeGroup: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          userId: { type: "string", example: "15" },
                          ageGroupId: { type: "string", example: "3" },
                          isActive: { type: "number", example: 1 },
                          created_at: { type: "string", example: "2025-10-02T12:34:56.789Z" },
                          updated_at: { type: "string", example: null, nullable: true }
                        }
                      },
                      message: { type: "string", example: "Age group saved successfully" }
                    }
                  }
                }
              }
            },
            400: {
              description: "Bad request - Missing or invalid parameters",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Missing required fields" },
                      details: { type: "string", example: "userId and ageGroupId are required" }
                    }
                  }
                }
              }
            },
            401: {
              description: "Unauthorized - Invalid or missing JWT token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Unauthorized" }
                    }
                  }
                }
              }
            },
            404: {
              description: "Not found - Invalid user ID or age group ID",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Age group not found" },
                      details: { type: "string", example: "Invalid age group ID" }
                    }
                  }
                }
              }
            },
            409: {
              description: "Conflict - Age group already selected",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Conflict" },
                      details: { type: "string", example: "This age group is already selected for the user" }
                    }
                  }
                }
              }
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Internal server error" },
                      details: { type: "string", example: "An unexpected error occurred" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/age-group/{userId}": {
        get: {
          summary: "Fetch user's active age group",
          description: "Returns the currently active age group for the specified user",
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
              description: "User ID as a string",
              schema: { type: "string", example: "15" }
            }
          ],
          responses: {
            200: {
              description: "User's active age group",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      userAgeGroup: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "1" },
                          userId: { type: "string", example: "15" },
                          ageGroupId: { type: "string", example: "3" },
                          isActive: { type: "number", example: 1 },
                          created_at: { type: "string", example: "2025-10-02T12:34:56.789Z" },
                          updated_at: { type: "string", example: null, nullable: true },
                          ageGroup: {
                            type: "object",
                            nullable: true,
                            properties: {
                              id: { type: "string", example: "3" },
                              ageRange: { type: "string", example: "25-29" },
                              minAge: { type: "number", example: 25, nullable: true },
                              maxAge: { type: "number", example: 29, nullable: true },
                              created_at: { type: "string", example: "2025-10-02T12:34:56.789Z" },
                              updated_at: { type: "string", example: null, nullable: true }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: "Bad request - Invalid userId parameter",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Invalid userId" },
                      details: { type: "string", example: "userId must be a positive number" }
                    }
                  }
                }
              }
            },
            401: {
              description: "Unauthorized - Invalid or missing JWT token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Unauthorized" }
                    }
                  }
                }
              }
            },
            404: {
              description: "Not found - No active age group for this user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Not found" },
                      details: { type: "string", example: "No active age group found for this user" }
                    }
                  }
                }
              }
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Internal server error" },
                      details: { type: "string", example: "An unexpected error occurred" }
                    }
                  }
                }
              }
            }
          }
        },
        delete: {
          summary: "Deactivate user's age group",
          description: "Deactivates the currently active age group for the specified user",
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
              description: "User ID as a string",
              schema: { type: "string", example: "15" }
            }
          ],
          responses: {
            200: {
              description: "Age group deactivated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Age group has been removed successfully" }
                    }
                  }
                }
              }
            },
            400: {
              description: "Bad request - Invalid userId parameter",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Invalid userId" },
                      details: { type: "string", example: "userId must be a positive number" }
                    }
                  }
                }
              }
            },
            401: {
              description: "Unauthorized - Invalid or missing JWT token",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Unauthorized" }
                    }
                  }
                }
              }
            },
            404: {
              description: "Not found - No active age group to deactivate",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Not found" },
                      details: { type: "string", example: "No active age group found for this user" }
                    }
                  }
                }
              }
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Internal server error" },
                      details: { type: "string", example: "An unexpected error occurred" }
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