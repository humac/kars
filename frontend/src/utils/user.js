/**
 * User-related utility functions
 */

/**
 * Formats a full name from first and last name parts
 * Handles null, undefined, and whitespace-only values gracefully
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} fallback - Value to return if name cannot be constructed (default: '')
 * @returns {string} Formatted full name or fallback
 *
 * @example
 * formatFullName('John', 'Doe') // 'John Doe'
 * formatFullName('John', '') // 'John'
 * formatFullName('', '') // ''
 * formatFullName(null, null, 'Unknown') // 'Unknown'
 */
export const formatFullName = (firstName, lastName, fallback = '') => {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();

  const fullName = [first, last].filter(Boolean).join(' ');
  return fullName || fallback;
};

/**
 * Formats a name from an object with first_name and last_name properties
 *
 * @param {Object} person - Object containing name properties
 * @param {string} person.first_name - First name
 * @param {string} person.last_name - Last name
 * @param {string} fallback - Value to return if name cannot be constructed
 * @returns {string} Formatted full name or fallback
 *
 * @example
 * formatPersonName({ first_name: 'John', last_name: 'Doe' }) // 'John Doe'
 * formatPersonName({ first_name: 'John' }) // 'John'
 * formatPersonName({}, 'N/A') // 'N/A'
 */
export const formatPersonName = (person, fallback = '') => {
  if (!person) return fallback;
  return formatFullName(person.first_name, person.last_name, fallback);
};

/**
 * Formats a manager name from an asset or user object
 * Looks for manager_first_name and manager_last_name properties
 *
 * @param {Object} record - Object containing manager name properties
 * @param {string} record.manager_first_name - Manager's first name
 * @param {string} record.manager_last_name - Manager's last name
 * @param {string} fallback - Value to return if name cannot be constructed
 * @returns {string} Formatted manager name or fallback
 *
 * @example
 * formatManagerName({ manager_first_name: 'Jane', manager_last_name: 'Smith' }) // 'Jane Smith'
 * formatManagerName({ manager_first_name: 'Jane' }) // 'Jane'
 * formatManagerName({}, 'No Manager') // 'No Manager'
 */
export const formatManagerName = (record, fallback = '') => {
  if (!record) return fallback;
  return formatFullName(record.manager_first_name, record.manager_last_name, fallback);
};

/**
 * Formats an employee name from an asset object
 * Looks for employee_first_name and employee_last_name properties
 *
 * @param {Object} asset - Asset object containing employee name properties
 * @param {string} asset.employee_first_name - Employee's first name
 * @param {string} asset.employee_last_name - Employee's last name
 * @param {string} fallback - Value to return if name cannot be constructed
 * @returns {string} Formatted employee name or fallback
 *
 * @example
 * formatEmployeeName({ employee_first_name: 'John', employee_last_name: 'Doe' }) // 'John Doe'
 */
export const formatEmployeeName = (asset, fallback = '') => {
  if (!asset) return fallback;
  return formatFullName(asset.employee_first_name, asset.employee_last_name, fallback);
};

/**
 * Gets initials from a name (first letter of first and last name)
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Initials (e.g., 'JD') or empty string
 *
 * @example
 * getInitials('John', 'Doe') // 'JD'
 * getInitials('John', '') // 'J'
 * getInitials('', '') // ''
 */
export const getInitials = (firstName, lastName) => {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();

  const initials = [first[0], last[0]].filter(Boolean).join('');
  return initials.toUpperCase();
};
