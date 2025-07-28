import os from "os";

// Setting a max number of workers to avoid running into issues with max
// connections on the database on modern machines with many cores.
export const MAX_WORKERS = 4;

const numWorkers = Math.min(os.cpus().length, MAX_WORKERS);

export default numWorkers;
