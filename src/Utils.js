// Date utils
export const formatDate = function(inputDate) {
  if (typeof(inputDate) === 'string') {
    return inputDate;
  }
	let year = inputDate.getFullYear();
	let month = inputDate.getMonth()+1;
	if (month < 10) {
		month = '0'+month;
	}
	let date = inputDate.getDate();
	if (date < 10) {
		date = '0'+date;
	}
  var dateString = year+"-"+month+"-"+date; // Need to rebuild it to get rid of time zone funniness
  return dateString;
}

// Dict utils
export const parseQueryString = function(query) {
  if (query.length <= 1) {
    return {};
  }
  if (query[0] === '?') {
    query = query.substr(1);
  }
  return query.split('&')
    .reduce(function(acc, x) {
      var tokens = x.split('=');
      if (tokens.length === 2) {
        acc[tokens[0]] = tokens[1];
      }
      return acc;
    }, {});
}
export const dictToQueryString = function(query, keys=null) {
  var output = [];
  for (var k in query) {
    if (keys && keys.indexOf(k) === -1) {
      continue;
    }
    if (query.hasOwnProperty(k)) {
      output.push([k,encodeURI(query[k])].join('='))
    }
  }
  return '?'+output.join('&');
}

export const splitDict = function(dict, keys) {
  // Split a dictionary into two, the first containing the keys in `keys`, and the second containing the rest
  keys = new Set(keys);
  let outputWithKey = {};
  let outputWithoutKey = {};
  Object.keys(dict).forEach(function(k){
    if (keys.has(k)) {
      outputWithKey[k] = dict[k];
    } else {
      outputWithoutKey[k] = dict[k];
    }
  });
  return [outputWithKey, outputWithoutKey];
}

export const dictEqual = function(dict1, dict2) {
  if (typeof dict1 !== 'object' && typeof dict2 !== 'object') {
    return dict1 === dict2;
  }
  if (!dict1 || !dict2) {
    return dict1 === dict2;
  }
  let keys1 = Object.keys(dict1);
  let keys2 = Object.keys(dict2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (let k of keys1) {
    if (keys2.indexOf(k) === -1) {
      return false;
    }
    if (!dictEqual(dict1[k],dict2[k])) {
      return false;
    }
  }
  return true;
}

export const arrayToDict = function(a, k) {
  let output = {};
  for (let x of a) {
    output[x[k]] = x;
  }
  return output;
}

// String utils
export const formatString = function(string, values) {
  return Object.keys(values).reduce(function(acc,key){
    return acc.replace('{'+key+'}', values[key]);
  }, string);
}
export const extractPlaceholders = function(string) {
  // Find all placeholders between braces and return them as a set
  let pattern = new RegExp('{([^{}]+)}','g');
  let output = new Set();
  while (true) {
    let match = pattern.exec(string);
    if (!match) {
      return output;
    }
    output.add(match[1]);
  }
}

// Float utils
export const clipFloat = function(val, decimalPlaces) {
  if (!val) {
    return val;
  }
  if (typeof val === 'string') {
    val = parseFloat(val);
  }
  let intPart = Math.floor(val);
  if (decimalPlaces === 0) {
    return String(intPart);
  }
  let decimalPart = val-intPart;
  let decimalString = String(decimalPart).substr(1, decimalPlaces+1);
  return String(intPart)+decimalString;
}

// Postgresql data type utils
export const stringifyPolygon = function(polygon) {
  console.log('Stringifying');
  console.log(polygon);
  if (typeof polygon === 'undefined' || polygon === null) {
    return null;
  }
  return JSON.stringify(polygon)
          .split('[').join('(')
          .split(']').join(')');
}

export const parsePolygon = function(polygon) {
  if (typeof polygon !== 'string') {
    return [];
  }
  return JSON.parse(
    polygon.split('(').join('[')
           .split(')').join(']')
  );
}

export const stringifyBox = function(box) {
  if (typeof box === 'undefined' || box === null) {
    return null;
  }
  return JSON.stringify(box)
          .split('[').join('(')
          .split(']').join(')');
}

export const parseBox = function(box) {
  if (typeof box !== 'string') {
    return null;
  }
  // Boxes are formatted as '(x,y),(x,y)', so we need to add brakets around that
  return JSON.parse(
    '['+box.split('(').join('[')
           .split(')').join(']')+']'
  );
}

// Store reducer utils
class StatusTreeNode {
  constructor(key, children) {
    this.key = key;
    this.children = children;
  }
}
export function getLoadingStatus(tree, filters, keysToCheck=null) {
	keysToCheck = keysToCheck || new Set(Object.keys(filters));
  if (tree && !(tree instanceof StatusTreeNode)) {
    return tree;
  }
  if (typeof tree === 'undefined' || keysToCheck.size === 0) {
    return null;
  }

  if (!keysToCheck.has(tree.key)) {
    return getLoadingStatus(tree.children[null], filters, keysToCheck);
  } else {
    keysToCheck = new Set(keysToCheck);
    keysToCheck.delete(tree.key);
    return getLoadingStatus(tree.children[filters[tree.key]], filters, keysToCheck) || getLoadingStatus(tree.children[null], filters, keysToCheck);
  }
}
export function updateLoadingStatus(tree, filters, status, keysToCheck=null) {
	keysToCheck = keysToCheck || new Set(Object.keys(filters));
  if (keysToCheck.size === 0) {
    return status;
  }
  if (tree && !(tree instanceof StatusTreeNode)) {
    return tree;
  }
  if (!tree) { // null or undefined tree
    let key = keysToCheck.values().next().value;
    keysToCheck = new Set(keysToCheck);
    keysToCheck.delete(key);
    return new StatusTreeNode(
      key,
      {
        [filters[key]]: updateLoadingStatus(
          null, filters, status, keysToCheck
        )
      }
    );
  }
  if (!keysToCheck.has(tree.key)) {
    return new StatusTreeNode(
      tree.key,
      {
        ...tree.children,
        [null]: updateLoadingStatus(tree[null], filters, status, keysToCheck)
      }
    );
  } else {
    keysToCheck = new Set(keysToCheck);
    keysToCheck.delete(tree.key);
    return new StatusTreeNode(
      tree.key,
      {
        ...tree.children,
        [filters[tree.key]]: updateLoadingStatus(
          null, filters, status, keysToCheck
        )
      }
    );
  }
}

// Diet utils
export function computeDietEntryTotal(entries) {
  if (!entries) {
    return {};
  }
  return entries.reduce((acc,entry) => {
    let total = {...acc};
    let childrenTotal = computeDietEntryTotal(entry.children);
    let keys = new Set(Object.keys(entry));
    for (let k of Object.keys(childrenTotal)) {
      keys.add(k);
    }
    keys.delete('children');
    for (let k of keys.values()) {
      let v = parseFloat(entry[k] || childrenTotal[k]);
      if (total[k]) {
        total[k] = total[k] + v;
      } else {
        total[k] = v;
      }
    }
    return total;
  }, {});
}

export function splitUnits(str) {
  if (str === null) {
    return {val: null, units: null}
  }
  let val = parseFloat(str);
  let units = str.substring(val.toString().length).trim();
  return {val: val, units: units}
}

export function computeScale(qty1, qty2) {
  // Return the multiplier to go from qty1 to qty2
  if (!qty1 || !qty2 || qty1.trim().length === 0 || qty2.trim().length === 0) {
    return null;
  }
  qty1 = splitUnits(qty1 || '');
  qty2 = splitUnits(qty2 || '');
  if (qty1['units'] !== qty2['units']) {
    return null;
  }
  return qty2['val']/qty1['val'];
}

export function fillEntry(dest, src) {
  let scalingNeeded = dest.quantity && dest.quantity.trim() !== 0 && src.quantity && src.quantity.trim().length !== 0;
  let scale = 1;
  if (scalingNeeded) {
    scale = computeScale(src.quantity, dest.quantity) || 1;
  }
  function foo(val1,val2,scale) {
    if (val1 && String(val1).trim().length > 0) {
      return val1;
    }
    if (val2) {
      return String(val2*scale);
    }
    return val1;
  }
  return {
    ...dest,
    name: dest.name || src.name,
    quantity: dest.quantity || src.quantity,
    calories: foo(dest.calories, src.calories, scale),
    protein: foo(dest.protein, src.protein, scale)
  }
}
