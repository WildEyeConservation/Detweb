import { Handler } from 'aws-lambda';
import * as mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const createTableQueries: { [key: string]: string } = {
  Project: `
    CREATE TABLE IF NOT EXISTS Project (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `,
  Category: `
    CREATE TABLE IF NOT EXISTS Category (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(255),
      shortcutKey VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `,
  Image: `
    CREATE TABLE IF NOT EXISTS Image (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      latitude FLOAT,
      longitude FLOAT,
      altitude_wgs84 FLOAT,
      altitude_agl FLOAT,
      altitude_egm96 FLOAT,
      width INT NOT NULL,
      height INT NOT NULL,
      roll FLOAT,
      yaw FLOAT,
      pitch FLOAT,
      timestamp TIMESTAMP,
      exifData TEXT,
      cameraSerial VARCHAR(255),
      originalId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (originalId) REFERENCES ImageFile(id)
    )
  `,
  ImageFile: `
    CREATE TABLE IF NOT EXISTS ImageFile (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      path VARCHAR(255) NOT NULL,
      imageId VARCHAR(255),
      key VARCHAR(255) NOT NULL,
      type VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (imageId) REFERENCES Image(id)
    )
  `,
  AnnotationSet: `
    CREATE TABLE IF NOT EXISTS AnnotationSet (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `,
  Annotation: `
    CREATE TABLE IF NOT EXISTS Annotation (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      setId VARCHAR(255) NOT NULL,
      source VARCHAR(255) NOT NULL,
      categoryId VARCHAR(255) NOT NULL,
      imageId VARCHAR(255) NOT NULL,
      x INT NOT NULL,
      y INT NOT NULL,
      obscured BOOLEAN,
      objectId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (setId) REFERENCES AnnotationSet(id),
      FOREIGN KEY (categoryId) REFERENCES Category(id),
      FOREIGN KEY (imageId) REFERENCES Image(id),
      FOREIGN KEY (objectId) REFERENCES Object(id)
    )
  `,
  Object: `
    CREATE TABLE IF NOT EXISTS Object (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      categoryId VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (categoryId) REFERENCES Category(id)
    )
  `,
  Location: `
    CREATE TABLE IF NOT EXISTS Location (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      imageId VARCHAR(255),
      setId VARCHAR(255) NOT NULL,
      height INT,
      width INT,
      x INT NOT NULL,
      y INT NOT NULL,
      source VARCHAR(255) NOT NULL,
      confidence FLOAT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (imageId) REFERENCES Image(id),
      FOREIGN KEY (setId) REFERENCES LocationSet(id)
    )
  `,
  Observation: `
    CREATE TABLE IF NOT EXISTS Observation (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      locationId VARCHAR(255) NOT NULL,
      annotationSetId VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id),
      FOREIGN KEY (locationId) REFERENCES Location(id),
      FOREIGN KEY (annotationSetId) REFERENCES AnnotationSet(id)
    )
  `,
  LocationSet: `
    CREATE TABLE IF NOT EXISTS LocationSet (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `,
  ImageSetMembership: `
    CREATE TABLE IF NOT EXISTS ImageSetMembership (
      id VARCHAR(255) PRIMARY KEY,
      imageId VARCHAR(255) NOT NULL,
      imageSetId VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (imageId) REFERENCES Image(id),
      FOREIGN KEY (imageSetId) REFERENCES ImageSet(id)
    )
  `,
  ImageSet: `
    CREATE TABLE IF NOT EXISTS ImageSet (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `,
  UserProjectMembership: `
    CREATE TABLE IF NOT EXISTS UserProjectMembership (
      id VARCHAR(255) PRIMARY KEY,
      userId VARCHAR(255) NOT NULL,
      projectId VARCHAR(255) NOT NULL,
      isAdmin BOOLEAN,
      queueUrl VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `,
  Queue: `
    CREATE TABLE IF NOT EXISTS Queue (
      id VARCHAR(255) PRIMARY KEY,
      projectId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id)
    )
  `
};

export const handler: Handler = async (event, context) => {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    // Create schema if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.query(`USE ${dbConfig.database}`);

    // Create tables
    for (const [tableName, query] of Object.entries(createTableQueries)) {
      await connection.query(query);
      console.log(`Table ${tableName} created or already exists.`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database and tables initialized successfully' }),
    };
  } catch (error) {
    console.error('Error initializing database:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error initializing database', 
        error: error instanceof Error ? error.message : String(error) 
      }),
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
