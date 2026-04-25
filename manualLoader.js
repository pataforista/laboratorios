/**
 * Manual Loader Module
 * Handles fetching and parsing of manual data (manifest, topics, printables)
 */

const BASE_PATH = './manual/dataset/';

/**
 * Fetches the manual manifest
 * @returns {Promise<Object>}
 */
export async function loadManualIndex() {
  try {
    const response = await fetch(`${BASE_PATH}manifest.json`);
    if (!response.ok) throw new Error('Failed to load manual manifest');
    return await response.ok ? response.json() : null;
  } catch (error) {
    console.error('Error loading manual index:', error);
    return null;
  }
}

/**
 * Fetches a specific topic by ID
 * @param {string} id - Topic ID
 * @returns {Promise<Object>}
 */
export async function loadTopic(id) {
  try {
    const response = await fetch(`${BASE_PATH}topics/${id}.json`);
    if (!response.ok) throw new Error(`Failed to load topic: ${id}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading topic ${id}:`, error);
    return null;
  }
}

/**
 * Fetches printable index or specific printable data
 * @param {string} id - Printable ID
 * @returns {Promise<Object>}
 */
export async function loadPrintable(id) {
  try {
    // Current manifest points printables to a generated_index.json
    // We'll fetch the index and find the specific one if needed
    const response = await fetch(`${BASE_PATH}printables/generated_index.json`);
    if (!response.ok) throw new Error('Failed to load printables index');
    const index = await response.json();
    return index.printables?.find(p => p.id === id) || null;
  } catch (error) {
    console.error('Error loading printable data:', error);
    return null;
  }
}
