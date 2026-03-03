"use client";

import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";

// Props for the data we want to visualize
interface WealthCubeProps {
    saved: number;
    spent: number;
    invested: number;
}

// The core 3D object that rotates
function Cube({ saved, spent, invested }: WealthCubeProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // Rotate slowly
    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += delta * 0.2;
            meshRef.current.rotation.y += delta * 0.3;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh
                ref={meshRef}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
                scale={hovered ? 1.1 : 1}
            >
                <boxGeometry args={[3, 3, 3]} />
                {/* We use an array of materials to map colors to faces for Saved/Spent/Invested representation */}
                <meshStandardMaterial attach="material-0" color={hovered ? "#4ADE80" : "#22C55E"} /> {/* Green: Saved */}
                <meshStandardMaterial attach="material-1" color={hovered ? "#F87171" : "#EF4444"} /> {/* Red: Spent */}
                <meshStandardMaterial attach="material-2" color={hovered ? "#60A5FA" : "#3B82F6"} /> {/* Blue: Invested */}
                <meshStandardMaterial attach="material-3" color="#FACC15" /> {/* Yellow: Misc */}
                <meshStandardMaterial attach="material-4" color="#A855F7" /> {/* Purple: Misc */}
                <meshStandardMaterial attach="material-5" color="#EC4899" /> {/* Pink: Misc */}

                {/* 3D Labeling using Drei's Text component */}
                <Text position={[0, 0, 1.51]} fontSize={0.3} color="#ffffff">
                    Saved: ₹{saved.toLocaleString()}
                </Text>
                <Text position={[1.51, 0, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.3} color="#ffffff">
                    Spent: ₹{spent.toLocaleString()}
                </Text>
                <Text position={[0, -1.51, 0]} rotation={[Math.PI / 2, 0, 0]} fontSize={0.3} color="#ffffff">
                    Invested: ₹{invested.toLocaleString()}
                </Text>
            </mesh>
        </Float>
    );
}

export default function WealthCubeWrapper({ saved, spent, invested }: WealthCubeProps) {
    return (
        <div className="w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden relative shadow-lg ring-1 ring-white/10">
            <div className="absolute top-4 left-4 z-10 text-white">
                <h3 className="font-bold text-lg">Interactive Wealth Cube</h3>
                <p className="text-sm text-slate-400">Drag to rotate • Scroll to zoom</p>
            </div>

            <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1.5} />
                <directionalLight position={[-5, 5, 5]} intensity={1} color="white" />

                {/* Render the cube mapping the props */}
                <Cube saved={saved} spent={spent} invested={invested} />

                {/* Allow users to interactively drag the cube around */}
                <OrbitControls enableZoom={true} autoRotate={false} />
            </Canvas>
        </div>
    );
}
