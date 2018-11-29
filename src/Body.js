import React, { Component } from 'react';
import { Link } from "react-router-dom";

import { select } from "d3-selection";
import { line } from "d3-shape";
import { scaleTime, scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { easeLinear } from "d3-ease";
import { } from "d3-transition"; // Needed for selection.transition

import { connect } from "react-redux";
import { fetchBodyweight, createBodyweight, deleteBodyweight } from './actions/Body.js'

import './Body.scss';

export class BodyStatsPage extends Component {
  render() {
    return (
      <div className='body-page-container'>
        <h2>Body Stats</h2>
        <BodyWeightTable />
        <BodyWeightTimeSeries />
        <BodyWeightScatterPlot />
      </div>
    );
  }
}

class ConnectedBodyWeightTable extends Component {
  constructor(props) {
    super(props);
    this.props.updateData();
  }
  getDeleteHandler(id) {
    var that = this;
    return function() {
      if (window.confirm('Delete entry?')) {
        that.props.deleteEntry(id);
      }
    }
  }
  render() {
    var that = this;
    return (
      <div className='bodyweight-table-container'>
        <NewBodyWeightEntryForm onAddWeight={this.updateData}/>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className='hide-mobile'>Time</th>
              <th>Weight</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.props.data.map(function(data, index){
              return (<tr key={data.id}>
                <td>{data.date}</td>
                <td className='hide-mobile'>{data.time}</td>
                <td>{data.bodyweight}</td>
                <td>
                  <Link to='#' onClick={that.getDeleteHandler(data.id)}>
                    <i className='material-icons'>delete</i>
                  </Link>
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
const BodyWeightTable = connect(
  function(state, ownProps) {
    return {data: state.bodyweight}
  },
  function(dispatch, ownProps) {
    return {
      updateData: () => dispatch(fetchBodyweight()),
      deleteEntry: (id) => dispatch(deleteBodyweight(id))
    };
  }
)(ConnectedBodyWeightTable);

class ConnectedNewBodyWeightEntryForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      bodyweight: '',
      successMessage: null,
      errorMessage: null
    };
    this.addWeight = this.addWeight.bind(this);
    this.handleFormChange = this.handleFormChange.bind(this);
  }
  addWeight(event) {
    event.preventDefault();
    var that = this;
    this.props.onSubmit(this.state.bodyweight)
      .then(function(response){
        that.setState({
          bodyweight: '',
          successMessage: 'Added successfully!',
          errorMessage: null
        });
      })
      .catch(function(error){
        console.error(error);
        that.setState({
          successMessage: null,
          errorMessage: 'Failed to add new entry'
        })
      });
  }
  handleFormChange(e) {
    var x = {successMessage: null, errorMessage: null};
    x[e.target.name] = e.target.value;
    this.setState(x);
  }
  render() {
    var classNames = [];
    if (this.state.successMessage) {
      classNames.push('valid');
    } else if (this.state.errorMessage) {
      classNames.push('invalid');
    }
    classNames = classNames.join(' ');
    return (
      <form action='#' onSubmit={this.addWeight}>
        <label htmlFor='bodyweight'>Body Weight: </label>
        <input type='text' name='bodyweight' className={classNames} value={this.state.bodyweight} onChange={this.handleFormChange} />
        <div className='success-message'>{this.state.successMessage}</div>
        <div className='error-message'>{this.state.errorMessage}</div>
      </form>
    );
  }
}
const NewBodyWeightEntryForm = connect(
  function(state, ownProps) {
    return {data: state.bodyweight}
  },
  function(dispatch, ownProps) {
    return {
      onSubmit: weight => dispatch(createBodyweight(weight))
    };
  }
)(ConnectedNewBodyWeightEntryForm);

class ConnectedBodyWeightTimeSeries extends Component {
  constructor(props) {
    super(props);
    this.updateSVG = this.updateSVG.bind(this);
    if (this.props.data.length === 0) {
      this.props.updateData();
    }
  }
  updateSVG(firstRender=false) {
    if (this.props.data.length === 0) {
      return null;
    }
    var data = this.props.data.map(function(datum){
      if (datum.time) {
        return {
          date: new Date(datum.date+" "+datum.time),
          value: datum.bodyweight
        };
      }
      return {
        date: new Date(datum.date), 
        value: datum.bodyweight
      };
    });
    if (!this.svg) {
      return null;
    }
    var width = this.svg.width.baseVal.value;
    var height = this.svg.height.baseVal.value;
    var padding = 45;
    var xScale = scaleTime()
      .domain(extent(data, p => p.date))
      .range([padding,width]);
    var yScale = scaleLinear()
      .domain(extent(data, p => p.value))
      .range([height-padding,0]);
    var xAxis = axisBottom(xScale);
    var yAxis = axisLeft(yScale);
    var lineGenerator = line()
      .x(p => xScale(p.date))
      .y(p => yScale(p.value));

    if (firstRender) {
      var path = select(this.svg)
        .select('.curves')
        .select('path')
        .attr('d',lineGenerator(data));
      var totalLength = path.node().getTotalLength();
      path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", -totalLength)
      window.p = path;
      path.transition()
        .duration(2000)
        .attr("stroke-dashoffset", 0);
    } else {
      select(this.svg)
        .select('.curves')
        .select('path')
        .transition()
        .duration(500)
        .attr('d',lineGenerator(data));
    }
    select(this.svg)
      .select('g.x-axis')
      .attr('transform', 'translate(0,'+(height-padding)+')')
      .transition()
      .duration(1000)
      .call(xAxis);
    select(this.svg)
      .select('g.y-axis')
      .attr('transform', 'translate('+(padding)+',0)')
      .transition()
      .duration(1000)
      .call(yAxis);
    select(this.svg)
      .select('text.x-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate('+((width-padding)/2+padding)+','+(height)+')')
      .text('Date');
    select(this.svg)
      .select('text.y-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate(10,'+((height-padding)/2)+') rotate(-90)')
      .text('Weight');
  }
  componentWillMount() {
    this.updateSVG();
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    var dataChanged = false;
    if (this.props.data.length !== prevProps.data.length) {
      dataChanged = true;
    } else {
      dataChanged = this.props.data.every(function(p,i) {
        for (var key in p) {
          if (p[key] !== prevProps.data[i][key]) {
            return true;
          }
        }
        return false;
      });
    }
    if (dataChanged) {
      this.updateSVG(prevProps.data.length === 0);
    }
  }
  render() {
    // Convert the data to numerical form
    return (
      <div className='bodyweight-plot-container'>
      <svg ref={x => this.svg = x}>
        <g className='x-axis'></g>
        <g className='y-axis'></g>
        <text className='x-axis'></text>
        <text className='y-axis'></text>
        <g className='curves'>
          <path d=""></path>
        </g>
      </svg>
      </div>
    );
  }
}
const BodyWeightTimeSeries = connect(
  function(state, ownProps) {
    return {data: state.bodyweight}
  },
  function(dispatch, ownProps) {
    return {
      updateData: () => dispatch(fetchBodyweight())
    };
  }
)(ConnectedBodyWeightTimeSeries);

class ConnectedBodyWeightScatterPlot extends Component {
  constructor(props) {
    super(props);
    this.updateSVG = this.updateSVG.bind(this);
    if (this.props.data.length === 0) {
      this.props.updateData();
    }
  }
  updateSVG(firstRender=false) {
    if (this.props.data.length === 0) {
      return null;
    }
    var data = this.props.data.map(function(datum){
      if (datum.time) {
        return {
          date: new Date(datum.date+" "+datum.time),
          value: datum.bodyweight
        };
      }
      return {
        date: new Date(datum.date), 
        value: datum.bodyweight
      };
    });
    if (!this.svg) {
      return null;
    }
    var width = this.svg.width.baseVal.value;
    var height = this.svg.height.baseVal.value;
    var padding = 45;
    var xScale = scaleTime()
      .domain(extent(data, p => p.date))
      .range([padding,width]);
    var yScale = scaleLinear()
      .domain(extent(data, p => p.value))
      .range([height-padding,0]);
    var xAxis = axisBottom(xScale);
    var yAxis = axisLeft(yScale);
    var lineGenerator = line()
      .x(p => xScale(p.date))
      .y(p => yScale(p.value));

    var points = select(this.svg)
      .select('.points')
      .selectAll('circle')
      .data(data)
    points.exit()
      .remove();
    points.enter()
      .append('circle')
      .attr('cx', (p,i) => xScale(p.date))
      .attr('cy', (p,i) => yScale(p.value))
      .attr('r', '3');
    select(this.svg)
      .select('g.x-axis')
      .attr('transform', 'translate(0,'+(height-padding)+')')
      .transition()
      .duration(1000)
      .call(xAxis);
    select(this.svg)
      .select('g.y-axis')
      .attr('transform', 'translate('+(padding)+',0)')
      .transition()
      .duration(1000)
      .call(yAxis);
    select(this.svg)
      .select('text.x-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate('+((width-padding)/2+padding)+','+(height)+')')
      .text('Time');
    select(this.svg)
      .select('text.y-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate(10,'+((height-padding)/2)+') rotate(-90)')
      .text('Weight');
  }
  componentWillMount() {
    this.updateSVG();
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    var dataChanged = false;
    if (this.props.data.length !== prevProps.data.length) {
      dataChanged = true;
    } else {
      dataChanged = this.props.data.every(function(p,i) {
        for (var key in p) {
          if (p[key] !== prevProps.data[i][key]) {
            return true;
          }
        }
        return false;
      });
    }
    if (dataChanged) {
      this.updateSVG(prevProps.data.length === 0);
    }
  }
  render() {
    // Convert the data to numerical form
    return (
      <div className='bodyweight-plot-container'>
      <svg ref={x => this.svg = x}>
        <g className='x-axis'></g>
        <g className='y-axis'></g>
        <text className='x-axis'></text>
        <text className='y-axis'></text>
        <g className='points'>
        </g>
      </svg>
      </div>
    );
  }
}
const BodyWeightScatterPlot = connect(
  function(state, ownProps) {
    return {data: state.bodyweight}
  },
  function(dispatch, ownProps) {
    return {
      updateData: () => dispatch(fetchBodyweight())
    };
  }
)(ConnectedBodyWeightScatterPlot);
