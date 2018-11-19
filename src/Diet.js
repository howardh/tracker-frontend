import React, { Component, Fragment } from 'react';
import { Link } from "react-router-dom";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormText } from 'reactstrap';
import axios from 'axios';

import { connect } from "react-redux";
import { fetchFood, createFood, updateFood, deleteFood } from './actions/Diet.js'

import './Diet.scss';

export class DietPage extends Component {
  constructor(props) {
    super(props)
    var now = new Date();
    var nowString = now.getFullYear()+"-"+(now.getMonth()+1)+"-"+now.getDate(); // Need to rebuild it to get rid of time zone funniness
    this.state = {
      date: nowString
    }
    this.handleDateChange = this.handleDateChange.bind(this);
  }
  handleDateChange(event) {
    this.setState({
      date: event.target.value
    });
  }
  render() {
    return (
      <FoodTable date={this.state.date} onDateChange={this.handleDateChange}/>
    );
  }
}

class FileUploadDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modal: false,
      predictions: []
    }
    this.ref = React.createRef();
    this.toggle = this.toggle.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.onUpload = props.onUpload;
    this.loadPrediction = this.loadPrediction.bind(this);
    this.getSelectPredictionHandler = this.getSelectPredictionHandler.bind(this);
  }
  uploadFile(event) {
    var target = event.target;
    var formData = new FormData();
    var that = this;
    formData.append("file", target.files[0]);
    axios.post(process.env.REACT_APP_SERVER_ADDRESS+"/data/food/photo", formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            withCredentials: true
        }).then(function(response){
          target.value = "";
          that.onUpload(that.props.files.concat([response.data.id]));
          that.loadPrediction(response.data.id);
        });
  }
  loadPrediction(photoId) {
    var that = this;
    axios.get(process.env.REACT_APP_SERVER_ADDRESS+"/data/food/photo/predict/"+photoId, {withCredentials: true})
        .then(function(response){
          that.setState({
            predictions: response.data
          });
        });
  }
  getSelectPredictionHandler(pred) {
    return function() {
      if (this.props.onSelectPrediction) {
        this.props.onSelectPrediction(pred);
      }
    }
  }
  toggle() {
    this.setState({
      modal: !this.state.modal
    });
  }
  render() {
    var that = this;
    return (
      <div>
        <Link to='#' onClick={this.toggle}>
          <i className="material-icons">add_a_photo</i>
        </Link>
        <Modal isOpen={this.state.modal} toggle={this.toggle} className="modal-sm">
          <ModalHeader toggle={this.toggle}>Upload Photo</ModalHeader>
          <ModalBody>
            <div className='thumbnails'>
              {
                this.props.files.map(function(file){
                  return <FoodPhotoThumbnail key={file} fileid={file}/>
                })
              }
            </div>
            <div className='predictions'>
              {
                this.state.predictions.map(function(s){
                  return <Link to='#' onClick={that.getSelectPredictionHandler(s)}>{s}</Link>
                })
              }
            </div>
            <FormGroup>
              <Label for="file"></Label>
              <Input type="file" name="file" accept="image/*" capture="camera" onChange={this.uploadFile}/>
              <FormText color="muted">
                Select a photo to include with your entry.
              </FormText>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onClick={this.toggle}>Done</Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
}

class FoodNameInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestions: [],
      loading: false,
      focused: false,
      selected: -1
    }
    this.ref = React.createRef();
    this.loadSuggestions = this.loadSuggestions.bind(this);
    this.loadSuggestionsTimeout = null;
    this.handleSelect = this.handleSelect.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.focus = this.focus.bind(this);
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.value !== this.props.value) {
      clearTimeout(this.loadSuggestionsTimeout);
      this.loadSuggestionsTimeout = setTimeout(this.loadSuggestions, 500);
    }
    if (prevState.selected !== this.state.selected) {
      if (this.state.selected === -1) {
        this.props.onHighlight({});
      } else if (this.props.onHighlight) {
        this.props.onHighlight(this.state.suggestions[this.state.selected]);
      }
    }
  }
  handleSelect() {
    // Check if the selection is valid
    if (this.state.selected === -1) {
      return;
    }
    // Call event handlers
    if (this.props.onSelect) {
      this.props.onSelect(this.state.suggestions[this.state.selected]);
    }
    // Clear search results and selection
    this.setState({
      selected: -1,
      suggestions: []
    });
  }
  handleBlur() {
    this.setState({
      focused: false
    });
  }
  handleFocus() {
    this.setState({
      focused: true
    });
  }
  handleKeyDown(event) {
    var UP = 38;
    var DOWN = 40;
    if (event.keyCode === DOWN) {
      this.setState({
        selected: (this.state.selected+2)%(this.state.suggestions.length+1)-1
      });
    } else if (event.keyCode === UP) {
      this.setState({
        selected: (this.state.selected+this.state.suggestions.length+1)%(this.state.suggestions.length+1)-1
      });
    }
  }
  handleKeyPress(event) {
    var RETURN = 13;
    if ((event.keyCode || event.which || event.charCode) === RETURN && this.state.selected !== -1) {
      this.handleSelect();
      // Prevent the key press from affecting other things (e.g. form submission).
      event.stopPropagation();
    }
  }
  getMouseEnterHandler(index) {
    var that = this;
    return function(event) {
      that.setState({
        selected: index
      });
    }
  }
  handleMouseDown(event) {
    this.handleSelect();
  }
  loadSuggestions() {
    if (this.props.value.length === 0) {
      this.setState({
        suggestions: [],
        loading: true
      });
      return;
    }
    var that = this;
    axios.get(process.env.REACT_APP_SERVER_ADDRESS+"/data/food/search?q="+encodeURI(this.props.value), {withCredentials: true})
        .then(function(response){
          window.result = response;
          that.setState({
            suggestions: response.data,
            loading: false
          });
        })
        .catch(function(error){
          console.error(error);
        });
  }
  focus() {
    this.ref.current.focus();
  }
  render() {
    var that = this;
    var inputField = (<input
              autocomplate='off'
              type='text'
              value={this.props.value}
              onKeyDown={this.handleKeyDown}
              onKeyPress={this.handleKeyPress}
              onChange={this.props.onChange}
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              name={this.props.name}
              ref={this.ref} />);
    var suggestions = (
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Cals</th>
            <th>Prot</th>
          </tr>
        </thead>
        <tbody onMouseDown={this.handleSelect}>
          {
            this.state.suggestions.map(function(item,index){
              var className = that.state.selected === index ? 'selected' : '';
              return (
                <tr className={className} key={item.id} onMouseEnter={that.getMouseEnterHandler(index)}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.calories}</td>
                  <td>{item.protein}</td>
                </tr>
              );
            })
          }
        </tbody>
      </table>
    );
    var loadingSuggestions = (
      <table>
        <thead>
          <tr>
            <th>name</th>
            <th>cals</th>
            <th>prot</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className='loading' colSpan='3'><div className='loader'></div></td></tr>
        </tbody>
      </table>
    );
    var s = null;
    if (this.props.value.length > 0 && this.state.focused) {
      if (this.state.loading) {
        s = loadingSuggestions;
      } else if (this.state.suggestions.length > 0) {
        s = suggestions;
      } else {
        s = null;
      }
    }
    return (
      <div className='food-name-input'>
        {inputField}
        {s}
      </div>
    );
  }
}

class QuantityInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      focused: false,
      startingValue: this.props.value
    };
    this.scaleQuantity = this.scaleQuantity.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }
  scaleQuantity() {
    function splitUnits(str) {
      var val = parseFloat(str);
      var units = str.substring(val.toString().length).trim();
      return {val: val, units: units}
    }
    // Split numbers and units
    var oldVals = splitUnits(this.state.startingValue);
    var newVals = splitUnits(this.props.value);

    // Check if the quantities use the same units
    if (oldVals['units'] !== newVals['units']) {
      return;
    }

    var scale = newVals['val']/oldVals['val'];

    // Check if the number is valid
    if (!isFinite(scale)) {
      return;
    }

    // Callback
    if (this.props.onScale) {
      this.props.onScale(scale);
    }
  }
  handleBlur() {
    this.scaleQuantity()
  }
  handleFocus() {
    this.setState({
      startingValue: this.props.value
    });
  }
  render() {
    return (
      <input
          type='text'
          value={this.props.value}
          placeholder={this.props.placeholder}
          onChange={this.props.onChange}
          onBlur={this.handleBlur}
          onFocus={this.handleFocus}
          name='quantity' />
    );
  }
}

class ConnectedFoodRowNewEntry extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      quantity: '',
      calories: '',
      protein: '',
      photos: [],
      suggestion: {}
    };
    this.addEntry = this.addEntry.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleHighlight = this.handleHighlight.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleQuantityScale = this.handleQuantityScale.bind(this);
  }
  addEntry(e) {
    // Submit entry to server
    var that = this;
    this.props.onSubmit({
      date: this.props.date,
      name: this.state.name,
      quantity: this.state.quantity,
      calories: this.state.calories,
      protein: this.state.protein,
      photos: this.state.photos
    }).then(function(response){
      // Clear form
      that.setState({
        name: '',
        quantity: '',
        calories: '',
        protein: '',
        photos: []
      });
      // Place cursor
      that.nameRef.focus();
    });
  }
  onChange(e) {
    var x = {}
    x[e.target.name] = e.target.value;
    this.setState(x);
  }
  onFileUpload(photoIds) {
    this.setState({
      photos: photoIds
    });
  }
  handleKeyPress(e) {
    if (e.key === 'Enter') {
      this.addEntry(e);
    }
  }
  handleHighlight(entry) {
    this.setState({
      suggestion: entry
    });
  }
  handleSelect(entry) {
    this.setState({
      name: entry.name,
      quantity: entry.quantity || this.state.quantity,
      calories: entry.calories || this.state.calories,
      protein: entry.protein || this.state.protein,
    });
  }
  handleQuantityScale(scale) {
    var cals = this.state.calories;
    if (isFinite(cals)) {
      cals = parseFloat(cals)*scale;
    }
    var prot = this.state.protein;
    if (isFinite(prot)) {
      prot = parseFloat(prot)*scale;
    }
    this.setState({
      calories: cals.toString(),
      protein: prot.toString()
    });
  }
  render() {
    return (
      <tr onKeyPress={this.handleKeyPress}>
        <td></td>
        <td>{this.props.date}</td>
        <td>
          <FoodNameInput 
              value={this.state.name} 
              onChange={this.onChange}
              onHighlight={this.handleHighlight}
              onSelect={this.handleSelect}
              name='name'
              ref={x => this.nameRef = x} />
        </td>
        <td>
          <QuantityInput
              value={this.state.quantity}
              placeholder={this.state.suggestion.quantity}
              onChange={this.onChange}
              onScale={this.handleQuantityScale}
              name='quantity' />
        </td>
        <td>
          <input
              type='text'
              value={this.state.calories}
              placeholder={this.state.suggestion.calories}
              onChange={this.onChange}
              name='calories' />
        </td>
        <td>
          <input 
              type='text'
              value={this.state.protein}
              placeholder={this.state.suggestion.protein}
              onChange={this.onChange}
              name='protein' />
        </td>
        <td>
          <FileUploadDialog onUpload={this.onFileUpload} files={this.state.photos}/>
        </td>
        <td><Button color='primary' onClick={this.addEntry}>Save</Button></td>
      </tr>
    );
  }
}
const FoodRowNewEntry = connect(
  function(state, ownProps) {
    return {}
  },
  function(dispatch, ownProps) {
    return {
      onSubmit: data => dispatch(createFood(data))
    };
  }
)(ConnectedFoodRowNewEntry);

class DropdownCheckbox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      checked: props.checked
    }
    this.toggle = this.toggle.bind(this);
  }
  toggle() {
    var newValue = !this.state.checked;
    this.setState({
      checked: newValue
    });
    if (this.props.onChange) {
      this.props.onChange(newValue);
    }
  }
  render() {
    return (
      <label className='dropdown-checkbox'>
        <i className='material-icons'>
          {this.state.checked ? 'arrow_drop_down':'arrow_right'}
        </i>
        <input type='checkbox' onChange={this.toggle}/>
      </label>
    );
  }
}

class ConnectedFoodRow extends Component {
  constructor(props) {
    super(props);
    console.log(props);
    this.state = { // Keep a copy of the data
      data: {
        ...props.data
      },
      dirty: false,
      expanded: false
    };
    this.dropdownCheckbox = React.createRef();
    this.toggleChildren = this.toggleChildren.bind(this);
  }
  getOnUpdateHandler(propName) {
    var that = this;
    return function(val) {
      // Update entry values
      var updatedEntry = {
        ...that.state.data,
        [propName]: val
      }
      that.setState({
        data: updatedEntry
      });
      that.props.updateEntry(that.props.id, updatedEntry);
    }
  }
  toggleChildren(visible) {
    this.setState({
      expanded: visible
    });
  }
  render() {
    var that = this;
    var selected = this.props.selected.has(this.props.id);
    return (
      <Fragment>
        <tr className={this.state.dirty ? 'table-info' : ''}>
          <td>
            {
              this.state.data.children.length > 0 && 
              <DropdownCheckbox 
                ref={this.dropdownCheckbox}
                onChange={this.toggleChildren} />
            }
          </td>
          <FoodRowCell value={this.state.data.date} onChange={this.getOnUpdateHandler('date')} />
          <FoodRowCell value={this.state.data.name} onChange={this.getOnUpdateHandler('name')} />
          <FoodRowCell value={this.state.data.quantity} onChange={this.getOnUpdateHandler('quantity')} />
          <FoodRowCell value={this.state.data.calories} onChange={this.getOnUpdateHandler('calories')} />
          <FoodRowCell value={this.state.data.protein} onChange={this.getOnUpdateHandler('protein')} />
          <td>
            <FileUploadDialog onUpload={this.getOnUpdateHandler('photos')} files={this.state.data.photos}/>
          </td>
          <td onClick={()=>this.props.onToggleSelected(this.props.id)}><input type='checkbox' checked={selected}/></td>
        </tr>
      </Fragment>
    );
  }
}
const FoodRow = connect(
  function(state, ownProps) {
    var entry = state.food.entries[ownProps.id];
    return {
      data: {
        date: entry.date || '',
        name: entry.name || '',
        quantity: entry.quantity || '',
        calories: entry.calories || '',
        protein: entry.protein || '',
        photos: entry.photos || [],
        children: entry.children || []
      }
    }
  },
  function(dispatch, ownProps) {
    return {
      updateEntry: (id, data) => dispatch(updateFood(id, data))
    };
  }
)(ConnectedFoodRow);

class FoodRowCell extends Component {
  constructor(props) {
    super(props)
    this.state = {
      edit: false,
    }
    this.onChange = props.onChange;
    this.startEdit = this.startEdit.bind(this);
    this.doneEdit = this.doneEdit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }
  startEdit(e) {
    this.setState({ edit: true });
  }
  doneEdit(e) {
    this.setState({ edit: false });
  }
  handleChange(e) {
    this.onChange(e.target.value);
  }
  handleKeyPress(e) {
    if (e.key === 'Enter') {
      this.doneEdit(e);
    }
  }
  render() {
    if (!this.state.edit) {
      return (
        <td onClick={this.startEdit}>{this.props.value}</td>
      );
    } else {
      return (
        <td><input type='textfield' value={this.props.value} onKeyPress={this.handleKeyPress} onBlur={this.doneEdit} onChange={this.handleChange}/></td>
      );
    }
  }
}

class FoodPhotoThumbnail extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: ""
    }
  }
  componentWillMount() {
    var that = this;
    axios.get(process.env.REACT_APP_SERVER_ADDRESS+"/data/food/photo/"+this.props.fileid, {withCredentials: true})
        .then(function(response){
          that.setState({data: response.data.data});
        });
  }
  render() {
    if (!this.state.data) {
      return (<i className="material-icons">fastfood</i>);
    } else {
      return (
        <img src={"data:image/png;base64,"+this.state.data} alt='Thumbnail'/>
      );
    }
  }
}

class ConnectedFoodTable extends Component {
  constructor(props){
    super(props)
    this.state = {
      selected: new Set()
    };
    //this.state.children = [
    //  {"id":1,"date":"2018-08-26","name":"asdf","quantity":"","calories":1,"protein":9,"photos":[]},
    //  {"id":2,"date":"2018-08-26","name":"asdf","quantity":"","calories":1,"protein":9,"photos":[], "children": 
    //    [{"id":3,"date":"2018-08-26","name":"child item","quantity":"","calories":1,"protein":9,"photos":[]},
    //    {"id":4,"date":"2018-08-26","name":"child item 2","quantity":"","calories":1,"protein":9,"photos":[]}],
    //  }
    //];
    this.deleteSelectedEntries = this.deleteSelectedEntries.bind(this);
    this.handleToggleSelected = this.handleToggleSelected.bind(this);

    this.props.updateData(this.props.date);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.date !== this.props.date) {
      this.props.updateData(this.props.date);
    }
  }
  handleToggleSelected(entryId) {
    /* Callback to be triggered when an entry has been selected. */
    var setCopy = new Set(this.state.selected);
    if (this.state.selected.has(entryId)){
      setCopy.delete(entryId);
    } else {
      setCopy.add(entryId);
    }
    this.setState({
      selected: setCopy
    });
  }
  deleteSelectedEntries(event) {
    event.preventDefault();
    var that = this;
    this.props.deleteEntry(Array.from(this.state.selected))
      .then(function(response) {
        that.setState({
          selected: new Set()
        });
        that.props.updateData(that.props.date);
      });
  }
  render() {
    var that = this;
    return (
      <div className='food-table'>
        <div className='controls'>
          <div className='table-controls'>
            <Form inline>
              <FormGroup>
                <Label for="date"><i className="material-icons">date_range</i></Label>
                <Input className='form-control' value={this.props.date} type='date' onChange={this.props.onDateChange}/>
              </FormGroup>
            </Form>
          </div>
          <div className='entry-controls'>
            <Link to='#' onClick={this.deleteSelectedEntries}><i className="material-icons">delete</i></Link>
          </div>
        </div>
        <table className="Food">
          <colgroup>
            <col className='expand' />
            <col />
            <col className='item'/>
            <col className='numbers'/>
            <col className='numbers'/>
            <col className='numbers'/>
            <col />
            <col className='actions' />
          </colgroup>
          <thead>
          <tr>
            <td>{this.props.dirty ? <i className='material-icons' alt='Saving changes...'>refresh</i> : <i className='material-icons' alt='Changes saved'>check</i>}</td>
            <th>Date</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Calories</th>
            <th>Protein</th>
            <th></th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          <tr>
            <td></td>
            <th>Total</th>
            <td></td>
            <td></td>
            <td>{this.props.total.calories}</td>
            <td>{this.props.total.protein}</td>
            <td></td>
          </tr>
          <FoodRowNewEntry date={this.props.date} />
          {
            this.props.ids.map(function(id){
              return <FoodRow key={id}
                          id={id}
                          selected={that.state.selected}
                          onToggleSelected={that.handleToggleSelected}/>
            })
          }
          </tbody>
        </table>
      </div>
    );
  }
}
const FoodTable = connect(
  function(state, ownProps) {
    var ids = state.food.entriesByDate[ownProps.date] || [];
    return {
      ids: ids,
      total: {
        calories: ids.map(
            id => state.food.entries[id].calories
          ).filter(
            val => val && isFinite(val)
          ).reduce(
            (acc, val) => acc+parseFloat(val), 0
          ),
        protein: ids.map(
            id => state.food.entries[id].protein
          ).filter(
            val => val && isFinite(val)
          ).reduce(
            (acc, val) => acc+parseFloat(val), 0
          )
      },
      dirty: state.food.dirtyEntries.size > 0
    }
  },
  function(dispatch, ownProps) {
    return {
      updateData: date => dispatch(fetchFood(date)),
      deleteEntry: ids => dispatch(deleteFood(ids))
    };
  }
)(ConnectedFoodTable);
