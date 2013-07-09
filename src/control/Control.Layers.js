/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

L.Control.Layers = L.Control.extend({
	options: {
		collapsed: true,
		position: 'topright',
		autoZIndex: true
	},

	initialize: function (baseLayers, overlays, overlayGroups, options) {
		
		L.setOptions(this, options);

		this._layers = {};
		this._overlayGroups = {};
		this._lastZIndex = 0;
		this._handlingClick = false;
		
		var i;

		for (i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
		
		var group = 0;
		for (i in overlayGroups) {
			this._addLayerGroup(group);
			for (var j in overlayGroups[i]) {
				this._addLayerToGroup(overlayGroups[i][j], j, group);
			}
			group++;
		}
		
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		map
		    .on('layeradd', this._onLayerChange, this)
		    .on('layerremove', this._onLayerChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map
		    .off('layeradd', this._onLayerChange)
		    .off('layerremove', this._onLayerChange);
	},

	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		this._update();
		return this;
	},

	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		this._update();
		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);
		delete this._layers[id];
		this._update();
		return this;
	},
	
	addOverlayGroup: function (overlayGroup) {
		var newGroupNum = Object.keys(this._overlayGroups).length;
		this._addLayerGroup(newGroupNum);
		for (var layer in overlayGroup) {
			this._addLayerToGroup(overlayGroup[layer], layer, newGroupNum);
		}
		this._update();
	},

	removeOverlayGroup: function (overlayGroup) {
		var layersInRemoveGroup = Object.keys(overlayGroup).length;
		for (var group in this._overlayGroups) {
			if (layersInRemoveGroup === Object.keys(this._overlayGroups[group]).length) {
				var groupFound = true;
				for (var rLayer in overlayGroup) {
					var layerFound = false;
					for (var pLayer in this._overlayGroups[group]) {
						if (overlayGroup[rLayer] === this._overlayGroups[group][pLayer].layer) {
							layerFound = true;
						}
					}
					
					if (!layerFound || !groupFound) {
						groupFound = false;
					}
					
				}
				
				if (groupFound) {
					delete this._overlayGroups[group];
				}
				
			}
		}
		this._update();
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = L.DomUtil.create('div', className);

		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!L.Browser.touch) {
			L.DomEvent.disableClickPropagation(container);
			L.DomEvent.on(container, 'mousewheel', L.DomEvent.stopPropagation);
		} else {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		var form = this._form = L.DomUtil.create('form', className + '-list');

		if (this.options.collapsed) {
			if (!L.Browser.android) {
				L.DomEvent
				    .on(container, 'mouseover', this._expand, this)
				    .on(container, 'mouseout', this._collapse, this);
			}
			var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
			link.href = '#';
			link.title = 'Layers';

			if (L.Browser.touch) {
				L.DomEvent
				    .on(link, 'click', L.DomEvent.stop)
				    .on(link, 'click', this._expand, this);
			}
			else {
				L.DomEvent.on(link, 'focus', this._expand, this);
			}

			this._map.on('click', this._collapse, this);
			// TODO keyboard accessibility
		} else {
			this._expand();
		}

		this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
		this._separator = L.DomUtil.create('div', className + '-separator', form);
		this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);
		this._overlayGroupsList = L.DomUtil.create('div', className + '-overlaygroups', this._form);

		container.appendChild(form);
	},

	_addLayer: function (layer, name, overlay) {
		var id = L.stamp(layer);

		this._layers[id] = {
			layer: layer,
			name: name,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

	_update: function () {
		if (!this._container) {
			return;
		}

		this._baseLayersList.innerHTML = '';
		this._overlaysList.innerHTML = '';
		this._overlayGroupsList.innerHTML = '';

		var baseLayersPresent = false,
		    overlaysPresent = false,
			overlayGroupsPresent = false,
		    i, obj;

		for (i in this._layers) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
		
		if (this._overlayGroups) {
			overlayGroupsPresent = true;
		} else {
			overlayGroupsPresent = false;
		}
		if (overlayGroupsPresent) {
			for (i in this._overlayGroups) {
				this._addGroup(this._overlayGroups[i]);
			}
		}
	},
	
	_addLayerGroup: function (group) {
		this._overlayGroups[group] = [];
	},

	_addLayerToGroup: function (layer, name, group) {
		var id = L.Util.stamp(layer);
		this._overlayGroups[group][id] = {
			layer: layer,
			name: name,
			group: group
		};
	},

	_onLayerChange: function (e) {
		var obj = this._layers[L.stamp(e.layer)];

		if (!obj) { return; }

		if (!this._handlingClick) {
			this._update();
		}

		var type = obj.overlay ?
			(e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'layeradd' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
		if (checked) {
			radioHtml += ' checked="checked"';
		}
		radioHtml += '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    input,
		    checked = this._map.hasLayer(obj.layer);

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers', checked);
		}

		input.layerId = L.stamp(obj.layer);

		L.DomEvent.on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		label.appendChild(input);
		label.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		return label;
	},
	
	_addGroup: function (group, onclick) {
		var separator = L.DomUtil.create('div', 'leaflet-control-layers-group-separator', this._form);
		var container = this._overlayGroupsList;
		container.appendChild(separator);
		for (var i in group) {
			this._addGroupItem(group[i], onclick);
		}
	},
	
	_addGroupItem: function (obj) {
		var label = document.createElement('label');

		var input = document.createElement('input');
		
		input.name = 'leaflet-overlay-group-' + obj.group;

		input.type = 'radio';
		input.checked = this._map.hasLayer(obj.layer);
		input.layerId = L.Util.stamp(obj.layer);

		L.DomEvent.addListener(input, 'click', this._onInputClick, this);

		var name = document.createTextNode(' ' + obj.name);

		label.appendChild(input);
		label.appendChild(name);

		var container = this._overlayGroupsList;
		container.appendChild(label);
	},

	_onInputClick: function () {
		var i, input, obj;

		var baseLayers = this._form.getElementsByClassName('leaflet-control-layers-base')[0];
		baseLayers = baseLayers.getElementsByTagName('input');
		var overlays = this._form.getElementsByClassName('leaflet-control-layers-overlays')[0];
		overlays = overlays.getElementsByTagName('input');
		var overlayGroups = this._form.getElementsByClassName('leaflet-control-layers-overlaygroups');

		this._handlingClick = true;

		
		for (i = 0; i < baseLayers.length; i++) {
			input = baseLayers[i];
			obj = this._layers[input.layerId];

			if (input.checked && !this._map.hasLayer(obj.layer)) {
				this._map.addLayer(obj.layer, !obj.overlay);
			} else if (!input.checked && this._map.hasLayer(obj.layer)) {
				this._map.removeLayer(obj.layer);
			}
		}
		
		var groupNum = 0;
		for (var group in this._overlayGroups) {
			var layerNum = 0;
			var overlayGroup = overlayGroups[groupNum].getElementsByTagName('input');
			for (var layer in this._overlayGroups[group]) {
				input = overlayGroup[layerNum];
				obj = this._overlayGroups[group][layer];

				if (input.checked && !this._map.hasLayer(obj.layer)) {
					this._map.removeLayer(obj.layer);
					this._map.addLayer(obj.layer, obj.overlay);
					this._map.fire('overlaygroupchange', obj);
				} else if (!input.checked && this._map.hasLayer(obj.layer)) {
					this._map.removeLayer(obj.layer);
				}
				layerNum++;
			}
			groupNum++;
		}
		
		for (i = 0; i < overlays.length; i++) {
			input = overlays[i];
			obj = this._layers[input.layerId];

			if (input.checked && !this._map.hasLayer(obj.layer)) {
				this._map.removeLayer(obj.layer);
				this._map.addLayer(obj.layer, obj.overlay);
			} else if (!input.checked && this._map.hasLayer(obj.layer)) {
				this._map.removeLayer(obj.layer);
			}
		}

		this._handlingClick = false;
	},

	_expand: function () {
		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
	},

	_collapse: function () {
		this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
	}
});

L.control.layers = function (baseLayers, overlays, overlayGroups, options) {
	return new L.Control.Layers(baseLayers, overlays, overlayGroups, options);
};
