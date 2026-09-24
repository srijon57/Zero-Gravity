uniform float uTime;

varying vec2 vUv;


void main(){

    float wave = sin(
        vUv.y * 80.0 - uTime * 2.0
    );


    wave = smoothstep(
        0.97,
        1.0,
        wave
    );


    vec3 glow = vec3(
        1.0,
        0.15,
        0.5
    );


    float intensity = wave * 0.15;


    gl_FragColor = vec4(
        glow * intensity,
        intensity
    );
}