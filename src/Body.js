import React, { Component, useState, useRef, useEffect } from 'react';

import { select } from "d3-selection";
import { line, area } from "d3-shape";
import { scaleTime, scaleLinear, scalePoint } from "d3-scale";
import { extent } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { } from "d3-transition"; // Needed for selection.transition

import { connect, useSelector, useDispatch } from "react-redux";
import {
  bodyweightActions,
  bodyweightSummaryActions
} from './actions/Actions.js';
import { formatDate, parseQueryString, getLoadingStatus } from './Utils.js';

import './Body.scss';

export class BodyStatsPage extends Component {
  constructor(props) {
    super(props);

    // If no date is provided, then set it to the current date
    var queryParams = parseQueryString(this.props.location.search);
    if (!queryParams['uid']) {
      queryParams['uid'] = this.props.uid;
    }
    this.state = {
      uid: queryParams['uid']
    };
  }
  render() {
    return (
      <main className='body-page-container'>
        <div className='background'>
        </div>
        <h2>Body Stats</h2>
        <BodyWeightTable uid={this.state.uid}/>
        <h3>Body Weight History</h3>
        <BodyWeightTimeSeries uid={this.state.uid} />
        <h3>Body Weight Fluctuations</h3>
        <BodyWeightHourlyStats uid={this.state.uid} />
      </main>
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
    let status = null;
    if (this.props.loadingStatus) {
      switch (this.props.loadingStatus.status) {
        case 'loading':
          status = (
            <tr className='status'>
              <td colSpan='999'>LOADING</td>
            </tr>
          );
          break;
        case 'loaded':
          if (this.props.data.length === 0) {
            status = (
              <tr className='status'>
                <td colSpan='999'>
                  <div>
                    You have no body weights on record.
                  </div>
                </td>
              </tr>
            );
          }
          break;
        case 'error':
          status = (
            <tr className='status'>
              <td colSpan='999'>
                <div className='error-message'>
                  Error: {this.props.loadingStatus.error}
                </div>
              </td>
            </tr>
          );
          break;
        default:
          status = null;
          break;
      }
    }
    return (
      <div className='bodyweight-table-container'>
        <NewBodyWeightEntryForm onAddWeight={this.updateData}/>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className='hide-mobile'>Time</th>
              <th>Weight ({this.props.units})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.props.data.map(function(data, index){
              return (<tr key={data.id}>
                <td>{data.date}</td>
                <td className='hide-mobile'>{data.time}</td>
                <td>{data.bodyweight.toFixed(1)}</td>
                <td>
                  <i className='material-icons action' onClick={that.getDeleteHandler(data.id)}>delete</i>
                </td>
              </tr>);
            })}
            { status }
          </tbody>
        </table>
      </div>
    );
  }
}
const BodyWeightTable = connect(
  function(state, ownProps) {
    let loadingStatus = getLoadingStatus(state.loadingStatus['BODYWEIGHT'], {page: 0});
    let data = Object.values(state.bodyweight.entities)
      .sort(function(entry1, entry2){
        if (entry1.date < entry2.date) {
          return 1;
        }
        if (entry1.date === entry2.date) {
          if (entry1.time < entry2.time) {
            return 1;
          }
        }
        return -1;
      });
    let user = state.userProfiles.entities[ownProps.uid] || {};
    return {
      loadingStatus,
      data,
      units: user.prefered_units
    };
  },
  function(dispatch, ownProps) {
    return {
      updateData: (page=0) => dispatch(bodyweightActions['fetchMultiple']({page})),
      deleteEntry: (id) => dispatch(bodyweightActions['deleteSingle'](id))
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

    var now = new Date();
    var nowString = formatDate(now);
    var timeString = now.getHours()+":"+(now.getMinutes())+":"+now.getSeconds();
    var payload = {
      date: nowString,
      time: timeString,
      bodyweight: parseFloat(this.state.bodyweight)
    }
    this.props.createWeight(payload)
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
      createWeight: weight => dispatch(bodyweightActions['create'](weight))
    };
  }
)(ConnectedNewBodyWeightEntryForm);

function BodyWeightTimeSeries(props) {
  let dispatch = useDispatch();
  let history = useSelector(state => 
    state.bodyweightSummary.history || {}
  );
  let loadingStatus = useSelector(state =>
    getLoadingStatus(state.loadingStatus['BODYWEIGHT_SUMMARY'], {}) || {}
  );
  let updateData = () => dispatch(bodyweightSummaryActions['fetchMultiple']());
  updateData();
  let svg = useRef(null);
  let [svgDims, setSvgDims] = useState([null,null]);
  function updateDims() {
    setSvgDims([svg.current.clientWidth, svg.current.clientHeight]);
  }
  useEffect(() => {
    if (!svg.current) {
      return;
    }
    window.addEventListener('resize', updateDims);
    return () => {
      window.removeEventListener('resize', updateDims);
    };
  }, [svg.current]);
  useEffect(() => {
    console.log('RENDERING');
    // Check if data is loaded
    if (loadingStatus.status !== 'loaded') {
      return;
    }
    if (!svg.current) {
      return;
    }
    // Process data
    let startDate = new Date(history.start_date);
    let endDate = new Date(history.end_date);
    let diff = (endDate-startDate)/history.data.length;
    let data = history.data.map(function(datum, index){
      return {
        date: new Date(startDate.getTime()+diff*index),
        value: datum
      };
    }).filter((x) => x.value !== null);
    // Compute sizes and scales
    var width = svg.current.width.baseVal.value;
    var height = svg.current.height.baseVal.value;
    var vbWidth = svg.current.viewBox.baseVal.width;
    var vbHeight = svg.current.viewBox.baseVal.height;
    let scale = vbHeight/height;
    let fontSize = 12*scale;
    var paddingLeft = fontSize*4;
    var paddingBottom = fontSize*3;
    var xScale = scaleTime()
      .domain(extent(data, p => p.date))
      .range([paddingLeft,vbWidth]);
    var yScale = scaleLinear()
      .domain(extent(data, p => p.value))
      .range([vbHeight-paddingBottom,0]);
    var xAxis = axisBottom(xScale)
      .ticks(Math.log(width/10));
    var yAxis = axisLeft(yScale)
      .ticks(Math.log(height));
    var xGridlines = axisBottom(xScale)
      .tickSizeInner(-vbHeight,0)
      .tickFormat('')
      .ticks(Math.log(width/10));
    var yGridlines = axisLeft(yScale)
      .tickSizeInner(-vbWidth,0)
      .tickFormat('')
      .ticks(Math.log(height));
    var lineGenerator = line()
      .x(p => xScale(p.date))
      .y(p => yScale(p.value));
    // Curve
    select(svg.current)
      .select('.curves')
      .select('path')
      .attr('d',lineGenerator(data));
    // Draw gridlines
    select(svg.current)
      .select('g.x-gridlines')
      .attr('transform', 'translate(0,'+(vbHeight-paddingBottom)+')')
      .attr("font-size", fontSize)
      .call(xGridlines);
    select(svg.current)
      .select('g.y-gridlines')
      .attr('transform', 'translate('+(paddingLeft)+',0)')
      .attr("font-size", fontSize)
      .call(yGridlines);
    // Axis + ticks
    select(svg.current)
      .select('g.x-axis')
      .attr('transform', 'translate(0,'+(vbHeight-paddingBottom)+')')
      .attr("font-size", fontSize)
      .call(xAxis);
    select(svg.current)
      .select('g.y-axis')
      .attr('transform', 'translate('+(paddingLeft)+',0)')
      .attr("font-size", fontSize)
      .call(yAxis);
    // Axis labels
    select(svg.current)
      .select('text.x-axis')
      .style("text-anchor", "middle")
      .attr("font-size", fontSize)
      .attr('transform', 'translate('+(vbWidth/2)+','+(vbHeight-fontSize/2)+')')
      .text('Date');
    select(svg.current)
      .select('text.y-axis')
      .style("text-anchor", "middle")
      .attr("font-size", fontSize)
      .attr('transform', 'translate('+fontSize+','+((vbHeight-paddingBottom)/2)+') rotate(-90)')
      .text('Weight');
  }, [svg.current, ...svgDims, history.data, loadingStatus.status]);
  return (
    <div className='bodyweight-plot-container'>
    <svg ref={svg} width='100%' viewBox='0 0 800 300' preserveAspectRatio="xMidYMid slice">
      <g className='x-gridlines'></g>
      <g className='y-gridlines'></g>
      <g className='x-axis'></g>
      <g className='y-axis'></g>
      <text className='x-axis'></text>
      <text className='y-axis'></text>
      <svg ref={svg} viewBox='0 0 800 300'>
        <g className='curves'>
          <path d=""></path>
        </g>
      </svg>
    </svg>
    </div>
  )
}

function BodyWeightHourlyStats(props) {
  let dispatch = useDispatch();
  let hourly_mean = useSelector(state => 
    state.bodyweightSummary.hourly_mean
  );
  let hourly_std = useSelector(state => 
    state.bodyweightSummary.hourly_std
  );
  let loadingStatus = useSelector(state =>
    getLoadingStatus(state.loadingStatus['BODYWEIGHT_SUMMARY'], {}) || {}
  );
  let updateData = () => dispatch(bodyweightSummaryActions['fetchMultiple']());
  updateData();
  let svg = useRef(null);
  let [svgDims, setSvgDims] = useState([null,null]);
  function updateDims() {
    setSvgDims([svg.current.clientWidth, svg.current.clientHeight]);
  }
  useEffect(() => {
    if (!svg.current) {
      return;
    }
    window.addEventListener('resize', updateDims);
    return () => {
      window.removeEventListener('resize', updateDims);
    };
  }, [svg.current]);
  useEffect(() => {
    console.log('RENDERING');
    // Check if data is loaded
    if (loadingStatus.status !== 'loaded') {
      return;
    }
    if (!svg.current) {
      return;
    }
    
    const hours = [
      '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM'
    ];
    let mean_weight = hourly_mean.reduce((a,b) => a+b, 0)/24;
    let data = hourly_mean 
      .map(function(datum, index){
        return {
          time: hours[index],
          value: (datum-mean_weight)/mean_weight
        };
      });
    let maxChange = data.reduce((a,d)=>d.value > a ? d.value : a, 0);
    console.log(maxChange);
    let stdData = hourly_std
      .map(function(datum, index){
        let std = datum/mean_weight*maxChange;
        return {
          time: hours[index],
          value0: data[index].value+std,
          value1: data[index].value-std
        };
      });
    console.log(hourly_std);
    window.std = hourly_std;
    window.stdData = stdData;

    var width = svg.current.width.baseVal.value;
    var height = svg.current.height.baseVal.value;
    var vbWidth = svg.current.viewBox.baseVal.width;
    var vbHeight = svg.current.viewBox.baseVal.height;
    let scale = vbHeight/height;
    let fontSize = 12*scale;
    var paddingLeft = fontSize*5;
    var paddingBottom = fontSize*3;
    // Scale
    var xScale = scalePoint()
      .padding(0.5)
      .domain(hours)
      .range([paddingLeft,vbWidth]);
    var yScale = scaleLinear()
      .domain(
        extent(
          extent(data, p => p.value).concat(
          extent(stdData, p => p.value0)).concat(
          extent(stdData, p => p.value1))
        )
      )
      .range([vbHeight-paddingBottom,0]);
    // Axis
    let numTicks = Math.floor(vbWidth/(fontSize*6));
    let visibleTicks = hours.filter((h,i) => i%Math.floor(hours.length/numTicks) === 0);
    var xAxis = axisBottom(xScale)
      .tickFormat(t => visibleTicks.includes(t) ? t : '');
    var yAxis = axisLeft(yScale)
      .tickFormat(t => (t > 0 ? '+' : '') + (t*100)+'%')
      .ticks(Math.log(height));
    var xGridlines = axisBottom(xScale)
      .tickSizeInner(-vbHeight,0)
      .tickFormat('');
    var yGridlines = axisLeft(yScale)
      .tickSizeInner(-vbWidth,0)
      .tickFormat('')
      .ticks(Math.log(height));
    var lineGenerator = line()
      .x(p => xScale(p.time))
      .y(p => yScale(p.value));
    let areaGenerator = area()
      .x(p => xScale(p.time))
      .y0(p => yScale(p.value0))
      .y1(p => yScale(p.value1));

    // Draw line
    select(svg.current)
      .select('.curves')
      .select('path')
      .attr('d',lineGenerator(data));
    select(svg.current)
      .select('.std')
      .select('path')
      .attr('d',areaGenerator(stdData));
    // Draw gridlines
    select(svg.current)
      .select('g.x-gridlines')
      .attr('transform', 'translate(0,'+(vbHeight-paddingBottom)+')')
      .attr("font-size", fontSize)
      .call(xGridlines);
    select(svg.current)
      .select('g.y-gridlines')
      .attr('transform', 'translate('+(paddingLeft)+',0)')
      .attr("font-size", fontSize)
      .call(yGridlines);
    // Draw axes
    select(svg.current)
      .select('g.x-axis')
      .attr('transform', 'translate(0,'+(vbHeight-paddingBottom)+')')
      .attr("font-size", fontSize)
      .call(xAxis);
    select(svg.current)
      .select('g.y-axis')
      .attr('transform', 'translate('+(paddingLeft)+',0)')
      .attr("font-size", fontSize)
      .call(yAxis);
    select(svg.current)
      .select('text.x-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate('+(vbWidth/2)+','+(vbHeight-fontSize/2)+')')
      .attr("font-size", fontSize)
      .text('Time');
    select(svg.current)
      .select('text.y-axis')
      .style("text-anchor", "middle")
      .attr('transform', 'translate('+fontSize+','+((vbHeight-paddingBottom)/2)+') rotate(-90)')
      .attr("font-size", fontSize)
      .text('Weight');
  }, [svg.current, svgDims, hourly_mean, hourly_std, loadingStatus.status]);
  return (
    <div className='bodyweight-plot-container'>
    <svg ref={svg} viewBox='0 0 800 300' preserveAspectRatio="xMidYMid slice">
      <g className='x-gridlines'></g>
      <g className='y-gridlines'></g>
      <g className='x-axis'></g>
      <g className='y-axis'></g>
      <text className='x-axis'></text>
      <text className='y-axis'></text>
      <svg ref={svg} viewBox='0 0 800 300'>
        <g className='std'>
          <path d=""></path>
        </g>
        <g className='curves'>
          <path d=""></path>
        </g>
      </svg>
    </svg>
    </div>
  )
}
