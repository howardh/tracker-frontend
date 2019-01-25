import { combineReducers } from 'redux'

import { 
  RECEIVE_FOOD,
  REQUEST_BODYWEIGHT,
  RECEIVE_BODYWEIGHT,
  REQUEST_USER_PROFILE,
  RECEIVE_USER_PROFILE
} from "../constants/action-types";

function createReducer(entityName) {
  let initialState = {
    entities: {},
    by: {},
    dirtyEntities: new Set() // IDs of entries that were modified
  }
  return function(state = initialState, action) {
    switch (action.type) {
      case 'FETCH_'+entityName+'_SUCCESS': {
        let filters = action.payload.filters || {};
        let data = action.payload.data;
        let ids = [];
        let entities = {};
        data.forEach(function(x){
          entities[x.id] = x;
          ids.push(x.id);
        });

        let filterKeys = Object.keys(filters);
        if (filterKeys.length == 1) {
          // If we filtered by one criterion, then update the 'by' object
          let filterKey = filterKeys[0];
          let filterValue = filters[filterKey];
          return {...state,
            by: {
              ...state.by,
              [filterKey]: {
                ...state.by[filterValue],
                [filterValue]: ids
              }
            },
            entities: {...state.entities, ...entities}
          };
        } else {
          // If there's moe than one filter, then only update the individual entities
          return {...state,
            entities: {...state.entities, ...entities}
          };
        }
      }
      case 'CREATE_'+entityName+'_SUCCESS': {
        let newEntity = action.payload.data;
        let by = {...state.by};
        for (let props in by) {
          let key = newEntity[props];
          if (key in by[props]) {
            by[props] = {
              ...by[props],
              [key]: [...by[props][key], newEntity.id]
            };
          }
        }
        return {
          ...state,
          entities: {...state.entities, [newEntity.id]: newEntity},
          by: by
        };
      }
      case 'UPDATE_'+entityName+'_START': {
        let newEntity = action.payload.data;
        let id = newEntity.id;
        // Add to set of dirty entries
        let dirtyEntities = new Set(state.dirtyEntities);
        dirtyEntities.add(id);
        // Look for changed properties
        let oldEntity = state.entities[id];
        let changedProps = [];
        for (let key in oldEntity) {
          if (oldEntity[key] !== newEntity[key]) {
            changedProps.push(key);
          }
        }
        // Update 'by'
        let by = {...state.by};
        changedProps.map(function(key){
          //TODO: Remove only by[key][oldEntity[key]] and by[key][newEntity[key]]
          by[key] = {};
        });
        // Create new state
        return {...state,
          entities: {...state.entities, [id]: newEntity},
          by: by,
          dirtyEntities: dirtyEntities
        };
      }
      case 'UPDATE_'+entityName+'_SUCCESS': {
        var id = action.payload.id;
        var dirtyEntities = new Set(state.dirtyEntities);
        dirtyEntities.delete(id);
        return {...state,
          dirtyEntities: dirtyEntities
        };
      }
      case 'DELETE_'+entityName+'_SUCCESS': {
        let filters = action.payload.filters;
        // Remove matching entities from `entities`
        let filteredKeys = Object.keys(state.entities).filter(function(key){
          let entity = state.entities[key];
          for (let props in filters) {
            if (entity[props] !== filters[props]) {
              return true;
            }
          }
          return false;
        });
        let entities = {};
        filteredKeys.map(function(key){
          entities[key] = state.entities[key];
        });
        // Remove matching entity IDs from `by`
        // TODO
        return {
          ...state,
          entities: entities
        };
      }
      default:
        return state;
    }
  }
}

function getLoadingStatus(tree, filters, keysToCheck) {
  if (typeof tree === 'string') {
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
function updateLoadingStatus(tree, filters, keysToCheck, status) {
  if (keysToCheck.size === 0) {
    return status;
  }
  if (typeof tree === 'string') {
    return tree;
  }
  if (!tree) { // null or undefined tree
    let key = keysToCheck.values().next().value;
    keysToCheck = new Set(keysToCheck);
    keysToCheck.delete(key);
    return {
      key: key,
      children: {
        [filters[key]]: updateLoadingStatus(
          null, filters, keysToCheck, status
        )
      }
    }
  }
  if (!keysToCheck.has(tree.key)) {
    return {
      key: tree.key,
      children: {
        ...tree.children,
        [null]: updateLoadingStatus(tree[null], filters, keysToCheck, status)
      }
    }
  } else {
    keysToCheck = new Set(keysToCheck);
    keysToCheck.delete(tree.key);
    if (tree.children[filters[tree.key]]) {
      return updateLoadingStatus(
        tree[filters[tree.key]], filters, keysToCheck, status
      );
    } else {
      return {
        key: tree.key,
        children: {
          ...tree.children,
          [filters[tree.key]]: updateLoadingStatus(
            null, filters, keysToCheck, status
          )
        }
      };
    }
  }
}
function loadingStatusReducer(state = {}, action) {
  switch (action.type) {
    case 'LOADING_START': {
      let entityName = action.payload.entityName;
      let filters = action.payload.filters;
      let filterKeys = new Set(Object.keys(filters));
      let statusTree = state[entityName];
      let newStatus = updateLoadingStatus(statusTree, filters, filterKeys, 'loading');
      return {
        ...state,
        newStatus
      }
    }
    case 'LOADING_SUCCESS': {
      let entityName = action.payload.entityName;
      let filters = action.payload.filters;
      let filterKeys = new Set(Object.keys(filters));
      let statusTree = state[entityName];
      let newStatus = updateLoadingStatus(statusTree, filters, filterKeys, 'loaded');
      return {
        ...state,
        newStatus
      }
    }
    case 'LOADING_FAILURE': {
      let entityName = action.payload.entityName;
      let filters = action.payload.filters;
      let filterKeys = new Set(Object.keys(filters));
      let statusTree = state[entityName];
      let newStatus = updateLoadingStatus(statusTree, filters, filterKeys, null);
      return {
        ...state,
        newStatus
      }
    }
    default:
      return state;
  }
}

function foodSummaryReducer(state = {history: null}, action) {
  switch (action.type) {
    case 'FETCH_FOOD_SUMMARY_SUCCESS': {
			let data = action.payload.data;
			return {
				...state,
				history: data
			}
    }
    default:
      return state;
  }
}

const initialUserState = {
  session: {},
  profiles: {} // Key: user id
};
function userReducer(state = initialUserState, action) {
  switch (action.type) {
    case 'UPDATE_SESSION_COMPLETED': {
      if (isFinite(action.payload)) {
        return {
          ...state,
          session: {
            uid: action.payload
          }
        };
      } else {
        return {
          ...state,
          session: {}
        };
      }
    }
    case 'LOGIN_START': {
      return {
        ...state,
        session: {
          loggingIn: true
        }
      };
    }
    case 'LOGIN_COMPLETED': {
      if (action.payload.error) {
        return {
          ...state,
          session: {
            error: action.payload.error
          }
        };
      }
      if (action.payload.id) {
        return {
          ...state,
          session: {
            uid: action.payload.id
          }
        };
      }
      return {};
    }
    case 'LOGOUT_COMPLETED': {
      return {
        ...state,
        session: {}
      };
    }
    case REQUEST_USER_PROFILE:
      var userId = action.payload.userId;
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [userId]: {
            loading: true
          }
        }
      }
    case RECEIVE_USER_PROFILE:
      var data = action.payload.data;
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [data.id]: data
        }
      }
    default:
      return state;
  }
}

const initialDataState = {
  photos: {},
  photoIds: null,
  photoIdsByDate: {},
  photoData: {},

  photoGroups: {},
  photoGroupIdsByDate: {},

  tagIds: [],
  tagsById: {},

  labelsById: {},
  labelIdsByPhotoId: {}
};
function dataReducer(state = initialDataState, action) {
  switch (action.type) {
    case 'FETCH_PHOTO_COMPLETED': {
      var data = action.payload.data;
      return {
        ...state,
        photos: {
          ...state.photos,
          ...data.reduce(function(acc,photo){
            acc[photo.id] = photo;
            return acc;
          }, {})
        },
        photoIds: data.map(p => p.id),
        photoIdsByDate: {
          ...state.photoIdsByDate,
          ...data.reduce(function(acc, photo) {
            if (!photo['date']) {
              return acc;
            }
            if (! (photo['date'] in acc)) {
              acc[photo['date']] = [photo.id];
            } else {
              acc[photo['date']].push(photo.id);
            }
            return acc;
          }, {})
        }
      };
    }
    case 'UPDATE_PHOTO_COMPLETED': {
      var id = action.payload.photoId;
      var data = action.payload.data;
      console.log('Updating photo entry');
      console.log(id);
      console.log(data);
      var oldEntry = state.photos[id];
      var newEntry = {
        ...oldEntry,
        ...data
      };
      if (oldEntry.date === newEntry.date) {
        var byDate = state.photoIdsByDate;
      } else {
        var byDate = {
          ...state.photoIdsByDate,
          [newEntry.date]: [...state.photoIdsByDate[newEntry.date], id]
        }
        byDate[oldEntry.date] = byDate[oldEntry.date].filter(x => x !== id)
      }
      return {
        ...state,
        photos: {
          ...state.photos,
          [id]: newEntry
        },
        photoIdsByDate: byDate
      };
    }
    case 'FETCH_PHOTO_GROUPS_COMPLETED': {
      var data = action.payload.data;
      return {
        ...state,
        photoGroups: data.reduce(function(acc,group){
          acc[group.id] = group;
          return acc;
        }, {}),
        photoGroupIdsByDate: {
          ...data.reduce(function(acc, group) {
            if (!group['date']) {
              return acc;
            }
            if (! (group['date'] in acc)) {
              acc[group['date']] = [group.id]
            } else {
              acc[group['date']].push(group.id);
            }
            return acc;
          }, {})
        }
      };
    }
    case 'FETCH_PHOTO_DATA_COMPLETED': {
      var id = action.payload.id;
      var data = action.payload.data;
      return {
        ...state,
        photoData: {
          ...state.photoData,
          [id]: data
        }
      };
    }
    case 'CREATE_PHOTO_COMPLETED': {
      var files = action.payload.files;
      var fileData = action.payload.fileData;
      var date = action.payload.date;
      var photoId = action.payload.id;
      var byDate = {...state.photoIdsByDate};
      if (date) {
        if (date in byDate) {
          byDate[date] = [...byDate[date], photoId];
        }
      }
      return {
        ...state,
        photoIds: [...state.photoIds, photoId],
        photoIdsByDate: byDate,
        photoData: {...state.photoData, [photoId]: fileData}
      };
    }
    case 'FETCH_TAGS_COMPLETED': {
      var tags = action.payload.data;
      return {
        ...state,
        tagIds: tags.map((t) => t.id),
        tagsById: tags.reduce((acc,t) => {acc[t.id] = t; return acc}, {})
      };
    }
    case 'FETCH_LABELS_COMPLETED': {
      var labels = action.payload.labels;
      return {
        ...state,
        labelsById: {
          ...state.labelsById,
          ...labels.reduce((acc,l) => {acc[l.id] = l; return acc}, {})
        },
        labelIdsByPhotoId: {
          ...state.labelIdsByPhotoId,
          [action.payload.photoId]: labels.map((l) => l.id)
        }
      };
    }
    case 'CREATE_TAG_START': {
      var tag = action.payload.data;
      return {
        ...state,
        tagIds: state.tagIds.concat([tag.id]),
        tagsById: {
          ...state.tagsById,
          [tag.id]: tag
        }
      };
    }
    case 'CREATE_LABEL_COMPLETED': {
      var label = action.payload.data;
      return {
        ...state,
        labelsById: {
          ...state.labelsById,
          [label.id]: label,
        },
        labelIdsByPhotoId: {
          ...state.labelIdsByPhotoId,
          [label.photo_id]: state.labelIdsByPhotoId[label.photo_id]
              .concat([label.id])
        }
      };
    }
    case 'UPDATE_LABEL_COMPLETED': {
      var label = action.payload.label;
      return {
        ...state,
        labelsById: {
          ...state.labelsById,
          [label.id]: label,
        }
      };
    }
    case 'DELETE_LABEL_COMPLETED': {
      var label = action.payload.data;
      var {[label.id]: removedLabel, ...newLabelsById} = state.labelsById; // FIXME: This isn't working in removing the label.
      return {
        ...state,
        labelsById: newLabelsById,
        labelIdsByPhotoId: {
          ...state.labelIdsByPhotoId,
          [label.photo_id]: state.labelIdsByPhotoId[label.photo_id]
                .filter(id => id !== label.id)
        }
      };
    }
    default:
      return state;
  }
}

const rootReducer = combineReducers({
  food: createReducer('FOOD'),
	foodSummary: foodSummaryReducer,
  photos: createReducer('PHOTOS'),
  photoGroups: createReducer('PHOTO_GROUPS'),
  tags: createReducer('TAGS'),
  labels: createReducer('LABELS'),
  bodyweight: createReducer('BODYWEIGHT'),
  loadingStatus: loadingStatusReducer,
  user: userReducer,
  data: dataReducer
});

export default rootReducer;
