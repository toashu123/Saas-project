// server/configs/db.js

import {neon} from '@neondatabase/serverless';

// Call the imported 'neon' function to create the 'sql' connection object
const sql = neon(`${process.env.DATABASE_URL}`);

// Export the connection object for other parts of your application to use
export default sql;