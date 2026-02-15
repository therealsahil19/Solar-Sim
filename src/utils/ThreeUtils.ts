import * as THREE from 'three';

/**
 * Extracts the world position from a matrix directly into a target vector.
 * This avoids creating new Vector3 objects and is faster than setFromMatrixPosition.
 * 
 * @param object The object to get the position of.
 * @param target The vector to store the position in.
 */
export function getPositionFromMatrix(object: THREE.Object3D, target: THREE.Vector3): void {
    const te = object.matrixWorld.elements;
    target.set(te[12], te[13], te[14]);
}
