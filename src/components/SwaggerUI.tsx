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
        url: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
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
      "/api/v1/system/toggle-route": {
        get: {
          summary: "List disabled API routes",
          description: "Returns the currently disabled exact and prefix route rules. If API_TOGGLE_SECRET is configured, send it in the x-api-toggle-secret header.",
          parameters: [
            {
              name: "x-api-toggle-secret",
              in: "header",
              required: false,
              description: "Optional secret header required when API_TOGGLE_SECRET is configured on the server.",
              schema: {
                type: "string"
              }
            }
          ],
          responses: {
            200: {
              description: "Current route toggle state",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      exactRoutes: {
                        type: "array",
                        items: { type: "string" },
                        example: ["/api/v1/products"]
                      },
                      prefixRoutes: {
                        type: "array",
                        items: { type: "string" },
                        example: ["/api/v1/users"]
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: "Unauthorized"
            }
          }
        },
        post: {
          summary: "Toggle an API route up or down",
          description: "Call this once to disable a route and call it again with the same route and scope to re-enable it.",
          parameters: [
            {
              name: "x-api-toggle-secret",
              in: "header",
              required: false,
              description: "Optional secret header required when API_TOGGLE_SECRET is configured on the server.",
              schema: {
                type: "string"
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["route"],
                  properties: {
                    route: {
                      type: "string",
                      example: "/api/v1/products"
                    },
                    scope: {
                      type: "string",
                      enum: ["exact", "prefix"],
                      default: "exact",
                      example: "exact"
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Route toggled",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      route: { type: "string", example: "/api/v1/products" },
                      scope: { type: "string", example: "exact" },
                      disabled: { type: "boolean", example: true },
                      status: { type: "string", example: "down" }
                    }
                  }
                }
              }
            },
            400: {
              description: "Invalid route or scope"
            },
            401: {
              description: "Unauthorized"
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
      },
      "/api/v1/fit-attributes": {
        get: {
          summary: "Fetch all fit attributes",
          description: "Returns a list of all available fit attributes grouped by attribute name",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "List of fit attributes grouped by attribute name",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            attributeName: { type: "string", example: "Shoulders" },
                            options: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "number", example: 1 },
                                  value: { type: "string", example: "Narrow" }
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
            400: {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      details: { type: "string" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        },
        post: {
          summary: "Save user fit attribute(s)",
          description: "Save single or multiple fit attributes for a user",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      required: ["userId", "fitAttributeId", "value"],
                      properties: {
                        userId: { type: "string", example: "15" },
                        fitAttributeId: { type: "string", example: "1" },
                        value: { type: "string", example: "34" }
                      }
                    },
                    {
                      type: "object",
                      required: ["userId", "attributes"],
                      properties: {
                        userId: { type: "string", example: "15" },
                        attributes: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              fitAttributeId: { type: "string" },
                              value: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          responses: {
            200: { description: "Success" },
            400: { description: "Bad request" },
            401: { description: "Unauthorized" },
            404: { description: "Not found" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/fit-attributes/{userId}": {
        get: {
          summary: "Fetch user's fit attributes",
          description: "Returns all active fit attributes for the specified user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", example: "15" }
            }
          ],
          responses: {
            200: { description: "User's fit attributes" },
            400: { description: "Bad request" },
            401: { description: "Unauthorized" },
            404: { description: "Not found" },
            500: { description: "Internal server error" }
          }
        },
        delete: {
          summary: "Delete user's fit attribute(s)",
          description: "Delete specific or all fit attributes for a user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", example: "15" }
            },
            {
              name: "fitAttributeId",
              in: "query",
              required: false,
              schema: { type: "string", example: "1" }
            }
          ],
          responses: {
            200: { description: "Deleted successfully" },
            400: { description: "Bad request" },
            401: { description: "Unauthorized" },
            404: { description: "Not found" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/products/stock": {
        post: {
          summary: "Update product stock",
          description: "Increment or decrement a product's stock quantity",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["productId", "quantityChange"],
                  properties: {
                    productId: { type: "number", example: 1 },
                    quantityChange: { type: "number", example: 5 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Stock updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Stock updated successfully" },
                      product: {
                        type: "object",
                        properties: {
                          id: { type: "number", example: 1 },
                          productname: { type: "string", example: "Example Product" },
                          stock: { type: "number", example: 15 }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: "Bad request - Invalid input or stock would fall below 0",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Stock cannot be reduced below 0" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        },
        patch: {
          summary: "Update product stock (Alias for POST)",
          description: "Increment or decrement a product's stock quantity",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["productId", "quantityChange"],
                  properties: {
                    productId: { type: "number", example: 1 },
                    quantityChange: { type: "number", example: -2 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Stock updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Stock updated successfully" },
                      product: {
                        type: "object",
                        properties: {
                          id: { type: "number", example: 1 },
                          productname: { type: "string", example: "Example Product" },
                          stock: { type: "number", example: 13 }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: "Bad request - Invalid input or stock would fall below 0",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Stock cannot be reduced below 0" }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/cart": {
        get: {
          tags: ["Cart"],
          summary: "Fetch the authenticated user's cart",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Cart contents with per-item totals and a summary",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            itemId: { type: "string", example: "1" },
                            productId: { type: "number", example: 12 },
                            quantity: { type: "number", example: 2 },
                            product: {
                              type: "object",
                              properties: {
                                id: { type: "number", example: 12 },
                                name: { type: "string", example: "Example Product" },
                                brand: { type: "string", example: "Acme" },
                                imageurl: { type: "string", example: "https://example.com/product.jpg" },
                                freedelivery: { type: "boolean", example: true },
                                price: { type: "number", example: 999 },
                                oldprice: { type: "number", example: 1299 },
                                discountpercent: { type: "number", example: 23 },
                                category: { type: "string", example: "Shoes", nullable: true }
                              }
                            },
                            totals: {
                              type: "object",
                              properties: {
                                total: { type: "number", example: 1998 },
                                youSave: { type: "number", example: 600 }
                              }
                            }
                          }
                        }
                      },
                      summary: {
                        type: "object",
                        properties: {
                          subtotal: { type: "number", example: 1998 },
                          youSave: { type: "number", example: 600 },
                          deliveryFee: { type: "number", example: 0 },
                          tax: { type: "number", example: 0 },
                          total: { type: "number", example: 1998 }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        },
        post: {
          tags: ["Cart"],
          summary: "Add a product to the cart",
          description: "Adds the product to the cart, or increments the quantity if it is already present. Returns the full updated cart.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["productId"],
                  properties: {
                    productId: { type: "number", example: 12 },
                    quantity: { type: "number", example: 1, default: 1 }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: "Updated cart (same shape as GET /api/v1/cart)" },
            400: {
              description: "Bad request - invalid productId/quantity, or product not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { error: { type: "string", example: "Product not found" } }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        },
        delete: {
          tags: ["Cart"],
          summary: "Remove a product from the cart",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["productId"],
                  properties: {
                    productId: { type: "number", example: 12 }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: "Updated cart (same shape as GET /api/v1/cart)" },
            400: {
              description: "Bad request - invalid productId, or item not in cart",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { error: { type: "string", example: "Cart item not found" } }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/products": {
        get: {
          tags: ["Products"],
          summary: "Fetch all active products",
          responses: {
            200: {
              description: "List of products",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      products: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "number", example: 12 },
                            productname: { type: "string", example: "Example Product" },
                            brand: { type: "string", example: "Acme" },
                            price: { type: "number", example: 999 },
                            oldprice: { type: "number", example: 1299 },
                            stock: { type: "number", example: 15 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/products/{productId}": {
        get: {
          tags: ["Products"],
          summary: "Fetch a single product by id",
          parameters: [
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Product record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      product: {
                        type: "object",
                        properties: {
                          id: { type: "number", example: 12 },
                          productname: { type: "string", example: "Example Product" },
                          brand: { type: "string", example: "Acme" },
                          price: { type: "number", example: 999 }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid product ID" },
            404: { description: "Product not found" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/products/by-category": {
        post: {
          tags: ["Products"],
          summary: "Fetch products by category id",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["categoryid"],
                  properties: {
                    categoryid: { type: "number", example: 3 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "List of products in the category",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      products: { type: "array", items: { type: "object" } }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid category ID" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/products/by-ids": {
        post: {
          tags: ["Products"],
          summary: "Fetch a single product by category id and product id",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["categoryId", "productId"],
                  properties: {
                    categoryId: { type: "number", example: 3 },
                    productId: { type: "number", example: 12 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Matching product",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { product: { type: "object" } }
                  }
                }
              }
            },
            400: { description: "Missing or invalid categoryId/productId" },
            404: { description: "Product not found" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/shoe-size": {
        get: {
          tags: ["Shoe Size"],
          summary: "Fetch all available shoe sizes and widths",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Distinct shoe sizes and widths",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      shoeSizes: { type: "array", items: { type: "number" }, example: [7, 8, 9, 10] },
                      widths: { type: "array", items: { type: "string" }, example: ["Narrow", "Regular", "Wide"] }
                    }
                  }
                }
              }
            },
            401: { description: "Unauthorized" },
            500: { description: "Internal server error" }
          }
        },
        post: {
          tags: ["Shoe Size"],
          summary: "Save the user's shoe size selection",
          description: "Looks up the shoe size record for the given size/width pair and activates it for the user.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId", "size", "width"],
                  properties: {
                    userId: { type: "string", example: "15" },
                    size: { type: "number", example: 9 },
                    width: { type: "string", example: "Regular" }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: "Shoe size saved successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      userShoeSize: { type: "object" },
                      message: { type: "string", example: "Shoe size saved successfully" }
                    }
                  }
                }
              }
            },
            400: { description: "Missing or invalid userId/size/width" },
            401: { description: "Unauthorized" },
            404: { description: "Shoe size or user not found" },
            409: { description: "Conflict - this shoe size is already active for the user" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/shoe-size/{userId}": {
        get: {
          tags: ["Shoe Size"],
          summary: "Fetch the user's active shoe size",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", example: "15" }
            }
          ],
          responses: {
            200: {
              description: "User's active shoe size",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { userShoeSize: { type: "object" } }
                  }
                }
              }
            },
            400: { description: "Invalid userId" },
            401: { description: "Unauthorized" },
            403: { description: "Forbidden - userId does not match the authenticated user" },
            404: { description: "No active shoe size found for this user" },
            500: { description: "Internal server error" }
          }
        },
        delete: {
          tags: ["Shoe Size"],
          summary: "Deactivate the user's shoe size",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { type: "string", example: "15" }
            }
          ],
          responses: {
            200: {
              description: "Shoe size selection removed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { message: { type: "string", example: "Shoe size selection removed successfully" } }
                  }
                }
              }
            },
            400: { description: "Invalid userId" },
            401: { description: "Unauthorized" },
            403: { description: "Forbidden - userId does not match the authenticated user" },
            404: { description: "No active shoe size found for this user" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/users/forgot-password": {
        post: {
          tags: ["Users"],
          summary: "Request a password reset OTP",
          description: "Sends a one-time password to the user's email if an account exists for it.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: { email: { type: "string", example: "john.doe@example.com" } }
                }
              }
            }
          },
          responses: {
            201: { description: "OTP sent" },
            400: { description: "Missing or invalid email" },
            404: { description: "User not available" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/users/verify-otp": {
        post: {
          tags: ["Users"],
          summary: "Verify a password reset OTP",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "otp"],
                  properties: {
                    email: { type: "string", example: "john.doe@example.com" },
                    otp: { type: "string", example: "123456" }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: "OTP verified - returns a reset token to use with reset-password",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { resetToken: { type: "string" } }
                  }
                }
              }
            },
            400: { description: "Missing/invalid email or OTP format" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/users/reset-password": {
        post: {
          tags: ["Users"],
          summary: "Reset password using a verified reset token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["resetToken", "newPassword", "confirmPassword"],
                  properties: {
                    resetToken: { type: "string" },
                    newPassword: { type: "string", example: "NewPassword123" },
                    confirmPassword: { type: "string", example: "NewPassword123" }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: "Password reset successfully" },
            400: { description: "Passwords do not match, password too short, or invalid/expired reset token" },
            500: { description: "Internal server error" }
          }
        }
      },
      "/api/v1/users/oauth-signin": {
        post: {
          tags: ["Users"],
          summary: "Start Google OAuth sign-in",
          description: "Returns an authorization URL to redirect the client to for Google OAuth. On completion Google redirects to /api/v1/users/oauth-callback.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    provider: { type: "string", enum: ["google"], example: "google" },
                    redirectTo: { type: "string", example: "https://app.example.com/api/v1/users/oauth-callback" }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: "Authorization URL generated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      url: { type: "string", example: "https://accounts.google.com/o/oauth2/..." },
                      provider: { type: "string", example: "google" }
                    }
                  }
                }
              }
            },
            400: { description: "Unsupported provider" },
            500: { description: "Failed to initiate OAuth sign-in" }
          }
        }
      },
      "/api/v1/users/oauth-callback": {
        get: {
          tags: ["Users"],
          summary: "Google OAuth callback",
          description: "Exchanges the authorization code for a session, creates or reuses the local user record, and issues a JWT. Returns JSON for popup/JSON requests, otherwise redirects with the token in the query string.",
          parameters: [
            {
              name: "code",
              in: "query",
              required: false,
              description: "Authorization code returned by Google",
              schema: { type: "string" }
            },
            {
              name: "error",
              in: "query",
              required: false,
              description: "Present if the OAuth provider returned an error instead of a code",
              schema: { type: "string" }
            },
            {
              name: "popup",
              in: "query",
              required: false,
              description: "Set to 'true' to receive a JSON response instead of a redirect",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OAuth authentication successful (JSON response for popup/JSON requests)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { type: "object" },
                      token: { type: "string" },
                      message: { type: "string", example: "OAuth authentication successful" },
                      popup: { type: "boolean", example: true }
                    }
                  }
                }
              }
            },
            302: { description: "Redirect to the configured success URL with token and user in the query string" },
            400: { description: "Missing authorization code, OAuth error, or missing user email" },
            500: { description: "Failed to exchange authorization code" }
          }
        }
      },
      "/api/v1/loop": {
        get: {
          tags: ["Test Fixtures"],
          summary: "Simulated infinite-loop response",
          description: "Always responds with HTTP 508 Loop Detected (RFC 5842). Used to test client handling of loop-detection responses.",
          responses: {
            508: {
              description: "Loop detected",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "Loop Detected" },
                      code: { type: "number", example: 508 },
                      message: { type: "string" },
                      hint: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/status/400/{id}": {
        get: {
          tags: ["Test Fixtures"],
          summary: "Crawler test fixture - always returns 400",
          description: "Always responds 400 Bad Request regardless of HTTP method or the :id value. Backs the 100 links on the /bad-request fixture page; :id (1-100) only exists so each link is a distinct URL that crawlers will not dedupe.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", example: "1" }
            }
          ],
          responses: {
            400: {
              description: "Intentional bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string", example: "Bad Request" },
                      statusCode: { type: "number", example: 400 },
                      message: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/callback": {
        get: {
          tags: ["Callback Storage"],
          summary: "List stored callback payloads",
          description: "Returns every JSON chunk previously saved via POST, grouped by recordId folder. Publicly aliased at /callback.",
          responses: {
            200: {
              description: "Stored callback records",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recordName: { type: "string", example: "Record_abc123" },
                        files: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              fileName: { type: "string", example: "1700000000000_a1b2c3.json" },
                              data: { type: "object" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            500: { description: "Internal server error" }
          }
        },
        post: {
          tags: ["Callback Storage"],
          summary: "Store a callback payload",
          description: "Streams the raw JSON body to disk under data/callback_OP/Record_<recordId>, where recordId is read from body.responseSet[0].recordId. Publicly aliased at /callback.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    responseSet: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { recordId: { type: "string", example: "abc123" } }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: "Chunk saved in folder Record_<recordId>" },
            400: { description: "Invalid JSON, or no/invalid recordId in the payload" },
            500: { description: "Internal server error during upload" }
          }
        }
      },
      "/api/hook/{token}": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request",
          description: "Captures any HTTP request sent to this URL (headers, query, body, sender info) for later inspection via /api/webhook/{token}/requests. Accepts GET, POST, PUT, PATCH, DELETE and HEAD - the response is identical regardless of method. Also reachable via the public aliases /hook/{token} and /valid-webhooks/{token}, and with an extra catch-all path segment, e.g. /api/hook/{token}/any/sub/path.",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              description: "Webhook token (10-128 chars, letters/digits/_/-)",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Request captured",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      message: { type: "string", example: "Request captured" },
                      token: { type: "string" },
                      requestId: { type: "string" },
                      receivedAt: { type: "string" },
                      method: { type: "string", example: "POST" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - this webhook requires authorization headers and/or query params that were missing or invalid" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        },
        post: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request (POST)",
          description: "Identical capture behavior to GET on this path - see the GET operation for details.",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              description: "Webhook token (10-128 chars, letters/digits/_/-)",
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } }
          },
          responses: {
            200: { description: "Request captured (same shape as GET on this path)" },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - this webhook requires authorization headers and/or query params that were missing or invalid" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        },
        put: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request (PUT)",
          description: "Identical capture behavior to GET on this path - see the GET operation for details.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } }
          },
          responses: {
            200: { description: "Request captured (same shape as GET on this path)" },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - this webhook requires authorization headers and/or query params that were missing or invalid" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        },
        patch: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request (PATCH)",
          description: "Identical capture behavior to GET on this path - see the GET operation for details.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object" } } }
          },
          responses: {
            200: { description: "Request captured (same shape as GET on this path)" },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - this webhook requires authorization headers and/or query params that were missing or invalid" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        },
        delete: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request (DELETE)",
          description: "Identical capture behavior to GET on this path - see the GET operation for details.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: { description: "Request captured (same shape as GET on this path)" },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - this webhook requires authorization headers and/or query params that were missing or invalid" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        }
      },
      "/api/webhook/{token}": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Capture an inbound webhook request (API-namespaced alias)",
          description: "Same capture behavior as /api/hook/{token}. Accepts GET, POST, PUT, PATCH and DELETE.",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: { description: "Request captured (same shape as /api/hook/{token})" },
            400: { description: "Invalid webhook token" },
            401: { description: "Unauthorized - missing/invalid authorization headers" },
            413: { description: "Webhook body exceeds maximum allowed size" },
            500: { description: "Failed to capture webhook request" }
          }
        }
      },
      "/api/webhook/{token}/requests": {
        get: {
          tags: ["Webhook Capture"],
          summary: "List captured requests for a webhook token",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Captured requests plus auth/blocked state",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      captureUrl: { type: "string" },
                      inspectUrl: { type: "string" },
                      requests: { type: "array", items: { type: "object" } },
                      authEnabled: { type: "boolean" },
                      blocked: { type: "array", items: { type: "object" } }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to load webhook requests" }
          }
        },
        delete: {
          tags: ["Webhook Capture"],
          summary: "Clear all captured requests for a webhook token",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "Requests cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      deleted: { type: "number", example: 3 }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to load webhook requests" }
          }
        }
      },
      "/api/webhook/{token}/auth": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Get the authorization requirement for a webhook token",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Current auth config",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      config: {
                        type: "object",
                        properties: {
                          enabled: { type: "boolean" },
                          headers: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string", example: "x-api-key" },
                                value: { type: "string", example: "secret123" }
                              }
                            }
                          },
                          queryEnabled: { type: "boolean" },
                          queryParams: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string", example: "callback_key" },
                                value: { type: "string", example: "secret123" }
                              }
                            }
                          },
                          updatedAt: { type: "string", nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process webhook authorization settings" }
          }
        },
        put: {
          tags: ["Webhook Capture"],
          summary: "Require specific headers and/or query params on inbound webhook requests",
          description: "Configures authorization for this webhook token. `enabled`/`headers` gate the required-header check and `queryEnabled`/`queryParams` gate the required-query-param check; the two are independent and can be on together, separately, or not at all. When both are on, a caller must satisfy both. Requests missing/mismatching a requirement are rejected with 401 and recorded as blocked attempts. `queryEnabled` and `queryParams` are optional and default to off, so header-only clients keep working unchanged.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["enabled", "headers"],
                  properties: {
                    enabled: { type: "boolean", example: true, description: "Turn the required-header check on or off." },
                    headers: {
                      type: "array",
                      maxItems: 10,
                      items: {
                        type: "object",
                        required: ["name", "value"],
                        properties: {
                          name: { type: "string", example: "x-api-key" },
                          value: { type: "string", example: "secret123" }
                        }
                      }
                    },
                    queryEnabled: { type: "boolean", example: true, description: "Turn the required-query-param check on or off." },
                    queryParams: {
                      type: "array",
                      maxItems: 10,
                      description: "Query params every callback must carry, e.g. /hook/{token}?callback_key=secret123. Names are case-sensitive and limited to letters, digits and _ . ~ - ; \"token\" and \"path\" are reserved. A required param repeated in one request is rejected.",
                      items: {
                        type: "object",
                        required: ["name", "value"],
                        properties: {
                          name: { type: "string", example: "callback_key" },
                          value: { type: "string", example: "secret123" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Auth config saved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      config: { type: "object" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token, or an invalid header/query param list" },
            500: { description: "Failed to process webhook authorization settings" }
          }
        },
        delete: {
          tags: ["Webhook Capture"],
          summary: "Clear every authorization requirement for a webhook token",
          description: "Removes both the header and the query param requirements.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Auth config cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      config: { type: "object" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process webhook authorization settings" }
          }
        }
      },
      "/api/webhook/{token}/auth-query": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Get the query param authorization requirement for a webhook token",
          description: "Returns only the query param half of the auth config. Use /api/webhook/{token}/auth to see headers and query params together.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Current query param auth config",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      config: {
                        type: "object",
                        properties: {
                          queryEnabled: { type: "boolean" },
                          queryParams: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string", example: "callback_key" },
                                value: { type: "string", example: "secret123" }
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
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process webhook query param authorization settings" }
          }
        },
        put: {
          tags: ["Webhook Capture"],
          summary: "Require specific query params on inbound webhook requests",
          description: "Sets the query param requirement on its own — any configured headers are left untouched. Senders then have to call /hook/{token}?<name>=<value>; a request missing a required param, sending a wrong value, or repeating a required param is rejected with 401 and recorded as a blocked attempt (with the secret values redacted from the logged URL). Names are case-sensitive and limited to letters, digits and _ . ~ - ; \"token\" and \"path\" are reserved because they are route parameters of the capture URL.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["queryParams"],
                  properties: {
                    queryEnabled: { type: "boolean", example: true, description: "Turn the check on or off. `enabled` is accepted as an alias." },
                    queryParams: {
                      type: "array",
                      maxItems: 10,
                      items: {
                        type: "object",
                        required: ["name", "value"],
                        properties: {
                          name: { type: "string", example: "callback_key" },
                          value: { type: "string", example: "secret123" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Query param auth config saved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      config: { type: "object", description: "The full auth config after the merge, headers included." }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token or invalid query param list" },
            500: { description: "Failed to process webhook query param authorization settings" }
          }
        },
        delete: {
          tags: ["Webhook Capture"],
          summary: "Clear the query param authorization requirement for a webhook token",
          description: "Turns the query param check off and drops the params. Configured headers are left in place.",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Query param auth config cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      config: { type: "object" }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process webhook query param authorization settings" }
          }
        }
      },
      "/api/webhook/{token}/blocked": {
        get: {
          tags: ["Webhook Capture"],
          summary: "List blocked (unauthorized) webhook attempts",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Blocked attempts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      blocked: { type: "array", items: { type: "object" } }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process blocked webhook attempts" }
          }
        },
        delete: {
          tags: ["Webhook Capture"],
          summary: "Clear blocked (unauthorized) webhook attempts",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Blocked attempts cleared",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      token: { type: "string" },
                      deleted: { type: "number", example: 2 }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid webhook token" },
            500: { description: "Failed to process blocked webhook attempts" }
          }
        }
      },
      "/api/webhook/{token}/download": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Download all captured request bodies as a zip",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Zip archive stream",
              content: { "application/zip": { schema: { type: "string", format: "binary" } } }
            },
            400: { description: "Invalid webhook token" },
            404: { description: "No captured request bodies to download" },
            500: { description: "Failed to build zip download" }
          }
        }
      },
      "/api/webhook/{token}/{requestId}/body": {
        get: {
          tags: ["Webhook Capture"],
          summary: "Download a single captured request body",
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } },
            { name: "requestId", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "Raw captured body, with Content-Type matching the original request",
              content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } }
            },
            400: { description: "Invalid token or request id" },
            404: { description: "Request not found or captured body file no longer available" },
            500: { description: "Failed to read captured body" }
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
