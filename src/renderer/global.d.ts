interface ElectronAPI {
  loadShapesFromJson: (imagePath: string) => Promise<any[]>;
} 