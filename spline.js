import * as THREE from "three";
import { DEFAULT_MAP } from "./js/maps/maps.js";


export function createSpline(mapConfig) {

    const points = [];

    const curvePath = mapConfig.curvePath;
    const trackScale = mapConfig.trackScale;

    for (let p = 0; p < curvePath.length; p += 3) {

        points.push(
            new THREE.Vector3(
                curvePath[p],
                curvePath[p + 1],
                curvePath[p + 2]
            ).multiplyScalar(trackScale)
        );

    }

    if (points.length > 2 && points[0].distanceTo(points[points.length - 1]) < 1e-6) {
        points.pop();
    }


    const spline = new THREE.CatmullRomCurve3(points, true);
    spline.arcLengthDivisions = 2000;
    spline.updateArcLengths();
    return spline;
}

const spline = createSpline(DEFAULT_MAP);
export default spline;