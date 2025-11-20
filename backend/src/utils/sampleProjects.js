// Sample project data for Houseway - House Design Company
const sampleProjects = [
  {
    title: "Modern Luxury Villa - Beverly Hills",
    description: "A stunning 5-bedroom contemporary villa featuring floor-to-ceiling windows, infinity pool, and smart home automation. The design emphasizes open spaces, natural light, and seamless indoor-outdoor living with premium finishes throughout.",
    status: "in-progress",
    priority: "high",
    projectType: "residential",
    designStyle: "modern",
    budget: {
      estimated: 2500000,
      actual: 1200000,
      currency: "USD"
    },
    timeline: {
      startDate: new Date('2024-03-15'),
      expectedEndDate: new Date('2025-01-30'),
      actualEndDate: null
    },
    location: {
      address: "1234 Sunset Boulevard",
      city: "Beverly Hills",
      state: "CA",
      zipCode: "90210",
      country: "USA",
      coordinates: {
        latitude: 34.0736,
        longitude: -118.4004
      }
    },
    specifications: {
      area: 8500,
      areaUnit: "sqft",
      floors: 2,
      bedrooms: 5,
      bathrooms: 6,
      parking: 3
    },
    progress: {
      percentage: 72,
      milestones: [
        {
          name: "Design Approval",
          description: "Complete architectural design approval",
          targetDate: new Date('2024-05-15'),
          completedDate: new Date('2024-05-15'),
          status: "completed"
        },
        {
          name: "Building Permits",
          description: "Obtain all required building permits",
          targetDate: new Date('2024-07-01'),
          completedDate: new Date('2024-07-01'),
          status: "completed"
        },
        {
          name: "Foundation Complete",
          description: "Foundation and structural work completion",
          targetDate: new Date('2024-08-15'),
          completedDate: new Date('2024-08-15'),
          status: "completed"
        },
        {
          name: "Framing Complete",
          description: "House framing and roofing",
          targetDate: new Date('2024-09-30'),
          completedDate: new Date('2024-09-30'),
          status: "completed"
        },
        {
          name: "Interior Construction",
          description: "Interior walls, electrical, and plumbing",
          targetDate: new Date('2024-12-15'),
          status: "in-progress"
        },
        {
          name: "Final Finishes",
          description: "Final interior finishes and landscaping",
          targetDate: new Date('2025-01-25'),
          status: "pending"
        }
      ]
    }
  },
  
  {
    title: "Sustainable Family Home - Austin",
    description: "An eco-friendly 4-bedroom home designed with sustainable materials and energy-efficient systems. Features include solar panels, rainwater harvesting, and native landscaping for minimal environmental impact.",
    status: "planning",
    priority: "medium",
    projectType: "residential",
    designStyle: "contemporary",
    budget: {
      estimated: 850000,
      actual: 45000,
      currency: "USD"
    },
    timeline: {
      startDate: new Date('2024-12-01'),
      expectedEndDate: new Date('2025-08-15'),
      actualEndDate: null
    },
    location: {
      address: "5678 Oak Hill Drive",
      city: "Austin",
      state: "TX",
      zipCode: "78749",
      country: "USA",
      coordinates: {
        latitude: 30.2672,
        longitude: -97.7431
      }
    },
    specifications: {
      area: 3200,
      areaUnit: "sqft",
      floors: 2,
      bedrooms: 4,
      bathrooms: 3,
      parking: 2
    },
    progress: {
      percentage: 15,
      milestones: [
        {
          name: "Initial Consultation",
          description: "Project kickoff and requirements gathering",
          targetDate: new Date('2024-11-15'),
          completedDate: new Date('2024-11-15'),
          status: "completed"
        },
        {
          name: "Site Survey",
          description: "Complete site analysis and survey",
          targetDate: new Date('2024-11-30'),
          completedDate: new Date('2024-11-30'),
          status: "completed"
        },
        {
          name: "Preliminary Design",
          description: "Initial design concepts and layouts",
          targetDate: new Date('2024-12-30'),
          status: "in-progress"
        },
        {
          name: "Final Design Approval",
          description: "Client approval of final design",
          targetDate: new Date('2025-01-30'),
          status: "pending"
        },
        {
          name: "Permit Submission",
          description: "Submit building permits to city",
          targetDate: new Date('2025-02-15'),
          status: "pending"
        }
      ]
    }
  },

  {
    title: "Historic Brownstone Renovation - Brooklyn",
    description: "Complete restoration of a 1920s Brooklyn brownstone, preserving original architectural details while adding modern amenities. Includes gut renovation, structural reinforcement, and period-appropriate finishes.",
    status: "completed",
    priority: "high",
    projectType: "renovation",
    designStyle: "traditional",
    budget: {
      estimated: 1200000,
      actual: 1180000,
      currency: "USD"
    },
    timeline: {
      startDate: new Date('2023-06-01'),
      expectedEndDate: new Date('2024-03-15'),
      actualEndDate: new Date('2024-03-10')
    },
    location: {
      address: "456 Park Slope Avenue",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11215",
      country: "USA",
      coordinates: {
        latitude: 40.6782,
        longitude: -73.9442
      }
    },
    specifications: {
      area: 4200,
      areaUnit: "sqft",
      floors: 4,
      bedrooms: 4,
      bathrooms: 3,
      parking: 0
    },
    progress: {
      percentage: 100,
      milestones: [
        {
          name: "Historic Approval",
          description: "Historic preservation committee approval",
          targetDate: new Date('2023-09-15'),
          completedDate: new Date('2023-09-15'),
          status: "completed"
        },
        {
          name: "Structural Assessment",
          description: "Complete structural engineering assessment",
          targetDate: new Date('2023-10-01'),
          completedDate: new Date('2023-10-01'),
          status: "completed"
        },
        {
          name: "Foundation Repair",
          description: "Foundation and structural repairs",
          targetDate: new Date('2023-11-15'),
          completedDate: new Date('2023-11-15'),
          status: "completed"
        },
        {
          name: "Interior Renovation",
          description: "Complete interior renovation work",
          targetDate: new Date('2024-02-15'),
          completedDate: new Date('2024-02-15'),
          status: "completed"
        },
        {
          name: "Final Inspection",
          description: "Final building inspection and approval",
          targetDate: new Date('2024-03-08'),
          completedDate: new Date('2024-03-08'),
          status: "completed"
        }
      ]
    }
  },

  {
    title: "Minimalist Beach House - Malibu",
    description: "A sleek, modern beach house with panoramic ocean views. Features clean lines, floor-to-ceiling glass, and sustainable materials. Designed to maximize natural light and ocean breezes.",
    status: "on-hold",
    priority: "low",
    projectType: "residential",
    designStyle: "minimalist",
    budget: {
      estimated: 3200000,
      actual: 180000,
      currency: "USD"
    },
    timeline: {
      startDate: new Date('2024-09-01'),
      expectedEndDate: new Date('2025-12-01'),
      actualEndDate: null
    },
    location: {
      address: "789 Pacific Coast Highway",
      city: "Malibu",
      state: "CA",
      zipCode: "90265",
      country: "USA",
      coordinates: {
        latitude: 34.0259,
        longitude: -118.7798
      }
    },
    specifications: {
      area: 5500,
      areaUnit: "sqft",
      floors: 2,
      bedrooms: 3,
      bathrooms: 4,
      parking: 2
    },
    progress: {
      percentage: 8,
      milestones: [
        {
          name: "Site Analysis",
          description: "Complete site analysis and feasibility study",
          targetDate: new Date('2024-09-15'),
          completedDate: new Date('2024-09-15'),
          status: "completed"
        },
        {
          name: "Conceptual Design",
          description: "Initial design concepts and layouts",
          targetDate: new Date('2024-11-30'),
          status: "pending"
        },
        {
          name: "Coastal Commission Review",
          description: "Coastal commission approval process",
          targetDate: new Date('2025-01-15'),
          status: "pending"
        }
      ]
    }
  },

  {
    title: "Contemporary Townhouse - Seattle",
    description: "A modern 3-story townhouse in Capitol Hill featuring industrial elements, exposed brick, and large windows. Designed for urban living with efficient use of space and natural materials.",
    status: "in-progress",
    priority: "medium",
    projectType: "residential",
    designStyle: "industrial",
    budget: {
      estimated: 750000,
      actual: 320000,
      currency: "USD"
    },
    timeline: {
      startDate: new Date('2024-08-01'),
      expectedEndDate: new Date('2025-04-15'),
      actualEndDate: null
    },
    location: {
      address: "321 Pine Street",
      city: "Seattle",
      state: "WA",
      zipCode: "98101",
      country: "USA",
      coordinates: {
        latitude: 47.6062,
        longitude: -122.3321
      }
    },
    specifications: {
      area: 2800,
      areaUnit: "sqft",
      floors: 3,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1
    },
    progress: {
      percentage: 45,
      milestones: [
        {
          name: "Design Approval",
          description: "Final design approval from client",
          targetDate: new Date('2024-09-30'),
          completedDate: new Date('2024-09-30'),
          status: "completed"
        },
        {
          name: "Building Permits",
          description: "Obtain all required building permits",
          targetDate: new Date('2024-11-01'),
          completedDate: new Date('2024-11-01'),
          status: "completed"
        },
        {
          name: "Foundation Complete",
          description: "Foundation and structural work",
          targetDate: new Date('2024-12-01'),
          completedDate: new Date('2024-12-01'),
          status: "completed"
        },
        {
          name: "Framing Complete",
          description: "House framing and roofing",
          targetDate: new Date('2025-01-15'),
          status: "in-progress"
        }
      ]
    }
  }
];

module.exports = sampleProjects;
