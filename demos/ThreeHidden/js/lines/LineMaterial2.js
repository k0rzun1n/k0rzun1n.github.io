/**
 * @author WestLangley / http://github.com/WestLangley
 *
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>,
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // to be set by renderer
 * }
 */

THREE.UniformsLib.line = {

	linewidth: { value: 1 },
	resolution: { value: new THREE.Vector2( 1, 1 ) },
	dashScale: { value: 1 },
	dashSize: { value: 1 },
	gapSize: { value: 1 }, // todo FIX - maybe change to totalSize
	tDepth: { value: 1 },
};

THREE.ShaderLib[ 'line' ] = {

	uniforms: THREE.UniformsUtils.merge( [
		THREE.UniformsLib.common,
		THREE.UniformsLib.fog,
		THREE.UniformsLib.line
	] ),

	vertexShader:
		`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		varying vec2 vUv;

		uniform float dashScale;
		attribute float instanceDistanceStart;
		attribute float instanceDistanceEnd;
		varying float vLineDistance;

		attribute vec3 f0norm;
		attribute vec3 f1norm;
		varying float vAlpha;
		varying vec3 vClipMid;

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif


			vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;


			float aspect = resolution.x / resolution.y;

			vUv = uv;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec2 ndcStart = clipStart.xy / clipStart.w;
			vec2 ndcEnd = clipEnd.xy / clipEnd.w;

			// direction
			vec2 dir = ndcEnd - ndcStart;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			// perpendicular to dir
			vec2 offset = vec2( dir.y, - dir.x );

			// undo aspect ratio adjustment
			dir.x /= aspect;
			offset.x /= aspect;

			// sign flip
			if ( position.x < 0.0 ) offset *= - 1.0;

			// endcaps
			if ( position.y < 0.0 ) {
				offset += - dir;
			} else if ( position.y > 1.0 ) {
				offset += dir;
			}

			// adjust for linewidth
			offset *= linewidth;

			// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
			offset /= resolution.y;

			// select end
			vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

			////
			vClipMid = clip.xyz/2.+0.5;
			// back to clip space
			offset *= clip.w;

			clip.xy += offset;

			vec3 mf0n = normalMatrix*f0norm;
			vec3 mf1n = normalMatrix*f1norm;
			
			//need 1 front and 1 back face neighbour, discard ff and bb
			//leave lines only when the angle between neghbours is more than the cos argument
			if(!(
				dot(mf0n,mf1n) < cos(PI/4.)  
				|| 
				mf0n.z<=0. && mf1n.z>0. || mf0n.z>=0. && mf1n.z<0. 
			))
				clip += vec4(f0norm,0.)*33333.;
			
			vAlpha = 1.;

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,

	fragmentShader:
		`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform vec2 resolution;
		uniform sampler2D tDepth;

		uniform float dashSize;
		uniform float gapSize;

		varying float vLineDistance;
		varying float vAlpha;
		varying vec3 vClipMid;

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		varying vec2 vUv;

		void main() {

			#include <clipping_planes_fragment>


			if ( abs( vUv.y ) > 1.0 ) {

				float a = vUv.x;
				float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
				float len2 = a * a + b * b;

				if ( len2 > 1.0 ) discard;

			}

			// vec4 diffuseColor = vec4( diffuse, opacity );
			vec4 diffuseColor = vec4( diffuse, vAlpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, diffuseColor.a );

			vec2 uv = (gl_FragCoord.xy/resolution);
			float aspect = resolution.x / resolution.y;
			
			vec2 step = vec2(0.003); //0.001 == 1px for 1000x1000 resolution
			step.y *= aspect;

			float visibility = 0.;
			float bias = 0.0003; 
			float spineDepth = vClipMid.z-bias;
			//center
			if(texture2D(tDepth,vClipMid.xy	+ vec2(0.)				).x > spineDepth) visibility += 0.2;
			//corners
			if(texture2D(tDepth,vClipMid.xy + vec2( step.x,  step.y)).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2( step.x, -step.y)).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2(-step.x,  step.y)).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2(-step.x, -step.y)).x > spineDepth) visibility += 0.2;
			//sides
			if(texture2D(tDepth,vClipMid.xy + vec2( 0.	  ,  step.y)).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2( 0.	  , -step.y)).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2( step.x, 0.     )).x > spineDepth) visibility += 0.2;
			if(texture2D(tDepth,vClipMid.xy + vec2(-step.x, 0.     )).x > spineDepth) visibility += 0.2;
			
			if(visibility == 0.){
				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps
				if ( mod( vLineDistance, dashSize + gapSize ) > dashSize ) discard; // todo - FIX
				gl_FragColor.rgb = vec3(1.,0.,0.); //color of backlines
			}else{
				gl_FragColor.a = visibility;
			}
			#include <premultiplied_alpha_fragment>
			#include <tonemapping_fragment>
			#include <encodings_fragment>
			#include <fog_fragment>

		}
		`
};

THREE.LineMaterial2 = function ( parameters ) {

	THREE.ShaderMaterial.call( this, {

		type: 'LineMaterial2',

		uniforms: THREE.UniformsUtils.clone( THREE.ShaderLib[ 'line' ].uniforms ),
		
		vertexShader: THREE.ShaderLib[ 'line' ].vertexShader,
		fragmentShader: THREE.ShaderLib[ 'line' ].fragmentShader

	} );

	this.dashed = false;

	Object.defineProperties( this, {

		color: {

			enumerable: true,

			get: function () {

				return this.uniforms.diffuse.value;

			},

			set: function ( value ) {

				this.uniforms.diffuse.value = value;

			}

		},

		linewidth: {

			enumerable: true,

			get: function () {

				return this.uniforms.linewidth.value;

			},

			set: function ( value ) {

				this.uniforms.linewidth.value = value;

			}

		},

		dashScale: {

			enumerable: true,

			get: function () {

				return this.uniforms.dashScale.value;

			},

			set: function ( value ) {

				this.uniforms.dashScale.value = value;

			}

		},

		dashSize: {

			enumerable: true,

			get: function () {

				return this.uniforms.dashSize.value;

			},

			set: function ( value ) {

				this.uniforms.dashSize.value = value;

			}

		},

		gapSize: {

			enumerable: true,

			get: function () {

				return this.uniforms.gapSize.value;

			},

			set: function ( value ) {

				this.uniforms.gapSize.value = value;

			}

		},

		resolution: {

			enumerable: true,

			get: function () {

				return this.uniforms.resolution.value;

			},

			set: function ( value ) {

				this.uniforms.resolution.value.copy( value );

			}

		},

		tDepth: {

			enumerable: true,

			get: function () {

				return this.uniforms.tDepth.value;

			},

			set: function ( value ) {

				this.uniforms.tDepth.value = value ;

			}

		}
	} );

	this.setValues( parameters );

};

THREE.LineMaterial2.prototype = Object.create( THREE.ShaderMaterial.prototype );
THREE.LineMaterial2.prototype.constructor = THREE.LineMaterial2;

THREE.LineMaterial2.prototype.isLineMaterial2 = true;

THREE.LineMaterial2.prototype.copy = function ( source ) {

	THREE.ShaderMaterial.prototype.copy.call( this, source );

	this.color.copy( source.color );

	this.linewidth = source.linewidth;

	this.resolution = source.resolution;

	// todo

	return this;

};

