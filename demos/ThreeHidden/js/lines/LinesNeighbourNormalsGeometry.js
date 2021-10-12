/**
 * @author WestLangley / http://github.com/WestLangley
 *
 */

THREE.LineNeighbourNormalsGeometry = function () {

    THREE.InstancedBufferGeometry.call(this);

    this.type = 'LineNeighbourNormalsGeometry';

    var plane = new THREE.BufferGeometry();

    var positions = [- 1,  2, 0, 1,  2, 0,
                     - 1,  1, 0, 1,  1, 0,
                     - 1,  0, 0, 1,  0, 0,
                     - 1, -1, 0, 1, -1, 0];
    
    var uvs = [-1,  2, 1,  2,
               -1,  1, 1,  1,
               -1, -1, 1, -1,
               -1, -2, 1, -2];

    var index = [0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5];

    this.setIndex(index);
    this.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

};

THREE.LineNeighbourNormalsGeometry.prototype = Object.assign(Object.create(THREE.InstancedBufferGeometry.prototype), {

    constructor: THREE.LineNeighbourNormalsGeometry,

    isLineNeighbourNormalsGeometry: true,

    applyMatrix: function (matrix) {

        var start = this.attributes.instanceStart;
        var end = this.attributes.instanceEnd;

        if (start !== undefined) {

            matrix.applyToBufferAttribute(start);

            matrix.applyToBufferAttribute(end);

            start.data.needsUpdate = true;

        }

        if (this.boundingBox !== null) {

            this.computeBoundingBox();

        }

        if (this.boundingSphere !== null) {

            this.computeBoundingSphere();

        }

        return this;

    },
    fromGeometry: function (geometry) {
        // helper variables
        var edge = [0, 0], edges = {}, edge1, edge2;
        var key, keys = ['a', 'b', 'c'];

        // prepare source geometry
        var geometry2;

        if (geometry.isBufferGeometry) {
            geometry2 = new THREE.Geometry();
            geometry2.fromBufferGeometry(geometry);
        } else {
            geometry2 = geometry.clone();
        }

        geometry2.mergeVertices();
        geometry2.computeFaceNormals();

        var sourceVertices = geometry2.vertices;
        var faces = geometry2.faces;
        // now create a data structure where each entry represents an edge with its adjoining faces
        for (var i = 0, l = faces.length; i < l; i++) {
            var face = faces[i];
            for (var j = 0; j < 3; j++) {
                edge1 = face[keys[j]];
                edge2 = face[keys[(j + 1) % 3]];
                edge[0] = Math.min(edge1, edge2);
                edge[1] = Math.max(edge1, edge2);

                key = edge[0] + ',' + edge[1];
                if (edges[key] === undefined) {
                    edges[key] = { index1: edge[0], index2: edge[1], face1: i, face2: undefined };
                } else {
                    edges[key].face2 = i;
                }
            }
        }

        var vertices = [];
        var normals = [];
        // generate vertices
        var cnt = 0;
        for (key in edges) {
            var e = edges[key];

            // an edge is only rendered if the angle (in degrees) between the face normals of the adjoining faces exceeds this value. default = 1 degree.
            // if ( e.face2 === undefined || faces[ e.face1 ].normal.dot( faces[ e.face2 ].normal ) <= thresholdDot ) {
            //     var vertex = sourceVertices[ e.index1 ];
            //     vertices.push( vertex.x, vertex.y, vertex.z );

            //     vertex = sourceVertices[ e.index2 ];
            //     vertices.push( vertex.x, vertex.y, vertex.z );
            // }

            var vertex = sourceVertices[e.index1];
            vertices.push(vertex.x, vertex.y, vertex.z);

            vertex = sourceVertices[e.index2];
            vertices.push(vertex.x, vertex.y, vertex.z);

            var norm = faces[e.face1].normal;
            normals.push(norm.x, norm.y, norm.z);

            norm = faces[e.face2].normal;
            normals.push(norm.x, norm.y, norm.z);
            // cnt++;
            // if(cnt>10) break;
        }

        var instanceBuffer = new THREE.InstancedInterleavedBuffer(new Float32Array(vertices), 6, 1); // xyz, xyz
        this.addAttribute('instanceStart', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 0)); // xyz
        this.addAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 3)); // xyz

        var instanceBufferNorm = new THREE.InstancedInterleavedBuffer(new Float32Array(normals), 6, 1); // xyz, xyz
        this.addAttribute('f0norm', new THREE.InterleavedBufferAttribute(instanceBufferNorm, 3, 0)); // xyz
        this.addAttribute('f1norm', new THREE.InterleavedBufferAttribute(instanceBufferNorm, 3, 3)); // xyz

		// this.computeBoundingBox();
		// this.computeBoundingSphere();

        return this;

    },

    ///// stuff below is copypasted and not tested

    setPositions: function (array) {

        var lineSegments;

        if (array instanceof Float32Array) {

            lineSegments = array;

        } else if (Array.isArray(array)) {

            lineSegments = new Float32Array(array);

        }

        var instanceBuffer = new THREE.InstancedInterleavedBuffer(lineSegments, 6, 1); // xyz, xyz

        this.addAttribute('instanceStart', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 0)); // xyz
        this.addAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 3)); // xyz

        /////

        this.computeBoundingBox();
        this.computeBoundingSphere();

        return this;

    },

    setColors: function (array) {

        var colors;

        if (array instanceof Float32Array) {

            colors = array;

        } else if (Array.isArray(array)) {

            colors = new Float32Array(array);

        }

        var instanceColorBuffer = new THREE.InstancedInterleavedBuffer(colors, 6, 1); // rgb, rgb

        this.addAttribute('instanceColorStart', new THREE.InterleavedBufferAttribute(instanceColorBuffer, 3, 0)); // rgb
        this.addAttribute('instanceColorEnd', new THREE.InterleavedBufferAttribute(instanceColorBuffer, 3, 3)); // rgb

        return this;

    },

    fromWireframeGeometry: function (geometry) {

        this.setPositions(geometry.attributes.position.array);

        return this;

    },

    fromEdgesGeometry: function (geometry) {

        this.setPositions(geometry.attributes.position.array);

        return this;

    },

    fromMesh: function (mesh) {

        this.fromWireframeGeometry(new THREE.WireframeGeometry(mesh.geometry));

        // set colors, maybe

        return this;

    },

    fromLineSegements: function (lineSegments) {

        var geometry = lineSegments.geometry;

        if (geometry.isGeometry) {

            this.setPositions(geometry.vertices);

        } else if (geometry.isBufferGeometry) {

            this.setPositions(geometry.position.array); // assumes non-indexed

        }

        // set colors, maybe

        return this;

    },

    computeBoundingBox: function () {

        var box = new THREE.Box3();

        return function computeBoundingBox() {

            if (this.boundingBox === null) {

                this.boundingBox = new THREE.Box3();

            }

            var start = this.attributes.instanceStart;
            var end = this.attributes.instanceEnd;

            if (start !== undefined && end !== undefined) {

                this.boundingBox.setFromBufferAttribute(start);

                box.setFromBufferAttribute(end);

                this.boundingBox.union(box);

            }

        };

    }(),

    computeBoundingSphere: function () {

        var vector = new THREE.Vector3();

        return function computeBoundingSphere() {

            if (this.boundingSphere === null) {

                this.boundingSphere = new THREE.Sphere();

            }

            if (this.boundingBox === null) {

                this.computeBoundingBox();

            }

            var start = this.attributes.instanceStart;
            var end = this.attributes.instanceEnd;

            if (start !== undefined && end !== undefined) {

                var center = this.boundingSphere.center;

                this.boundingBox.getCenter(center);

                var maxRadiusSq = 0;

                for (var i = 0, il = start.count; i < il; i++) {

                    vector.fromBufferAttribute(start, i);
                    maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));

                    vector.fromBufferAttribute(end, i);
                    maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));

                }

                this.boundingSphere.radius = Math.sqrt(maxRadiusSq);

                if (isNaN(this.boundingSphere.radius)) {

                    console.error('THREE.LineNeighbourNormalsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.', this);

                }

            }

        };

    }(),

    toJSON: function () {

        // todo

    },

    clone: function () {

        // todo

    },

    copy: function (source) {

        // todo

        return this;

    }

});
