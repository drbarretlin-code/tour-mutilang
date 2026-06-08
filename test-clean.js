function cleanUndefined(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          cleaned[key] = cleanUndefined(value);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

const obj = { dates: { startDate: "2023", flexDays: undefined } };
console.log(JSON.stringify(cleanUndefined(obj)));
