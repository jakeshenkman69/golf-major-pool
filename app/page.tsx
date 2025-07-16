// Add these state variables to your component (add to existing useState declarations)
const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
const [uploadMessage, setUploadMessage] = useState<string>('');

// Enhanced handleFileUpload function - replace your existing one
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!selectedTournament) {
    alert('Please select a tournament first!');
    return;
  }

  setUploadStatus('uploading');
  setUploadMessage('Processing CSV file...');

  try {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

    // Parse CSV with better validation
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check if first line might be a header
    const hasHeader = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('golfer');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsedGolfers = dataLines.map((line, index) => {
      const columns = line.split(',').map(col => col.trim());
      const name = columns[0];
      
      if (!name || name.length < 2) {
        console.warn(`Skipping invalid golfer name at line ${index + (hasHeader ? 2 : 1)}: "${name}"`);
        return null;
      }

      return { name, order: index };
    }).filter((golfer): golfer is Golfer => golfer !== null);

    if (parsedGolfers.length === 0) {
      throw new Error('No valid golfer names found in CSV');
    }

    setUploadMessage(`Found ${parsedGolfers.length} golfers. Organizing into tiers...`);

    // Update state first
    setGolfers(parsedGolfers);

    // Organize into tiers
    const newTiers: TierData = {
      tier1: parsedGolfers.slice(0, 10),
      tier2: parsedGolfers.slice(10, 20),
      tier3: parsedGolfers.slice(20, 30),
      tier4: parsedGolfers.slice(30, 40),
      tier5: parsedGolfers.slice(40, 50),
      tier6: parsedGolfers.slice(50)
    };
    setTiers(newTiers);

    setUploadMessage('Saving to database...');

    // Save to database with the new data
    await supabase
      .from('tournaments')
      .upsert({
        tournament_key: selectedTournament,
        name: tournaments[selectedTournament]?.name,
        golfers: parsedGolfers,
        tiers: newTiers,
        updated_at: new Date().toISOString()
      });

    setUploadStatus('success');
    setUploadMessage(`Successfully uploaded and saved ${parsedGolfers.length} golfers to the database!`);
    
    // Clear the file input
    event.target.value = '';

    // Clear success message after 5 seconds
    setTimeout(() => {
      setUploadStatus('idle');
      setUploadMessage('');
    }, 5000);

  } catch (error) {
    console.error('Error uploading CSV:', error);
    setUploadStatus('error');
    setUploadMessage(error instanceof Error ? error.message : 'Failed to upload CSV file');
    
    // Clear error message after 5 seconds
    setTimeout(() => {
      setUploadStatus('idle');
      setUploadMessage('');
    }, 5000);
  }
};

// Enhanced Setup Tab JSX - replace your existing setup tab content
{activeTab === 'setup' && isAdminMode && (
  <div className="space-y-4 sm:space-y-6">
    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
      <h3 className="font-semibold mb-2 text-blue-800 text-sm sm:text-base">Upload Golfers</h3>
      <p className="text-xs sm:text-sm text-blue-600 mb-3">
        Upload a CSV file with golfer names. Golfers will be organized into tiers based on the order they appear in the file.
        The CSV should have golfer names in the first column.
      </p>
      
      {/* File input */}
      <div className="mb-3">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploadStatus === 'uploading' || !selectedTournament}
          className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Upload status */}
      {uploadStatus !== 'idle' && (
        <div className={`p-3 rounded-lg border ${
          uploadStatus === 'uploading' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          uploadStatus === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {uploadStatus === 'uploading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
            )}
            {uploadStatus === 'success' && <span className="text-green-600">✓</span>}
            {uploadStatus === 'error' && <span className="text-red-600">✗</span>}
            <span className="text-sm font-medium">{uploadMessage}</span>
          </div>
        </div>
      )}

      {/* Database connection status */}
      <div className="mt-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded">
        <p className="text-xs text-green-800 font-medium">✓ Database Connected:</p>
        <p className="text-xs text-green-700 mt-1">
          All changes are automatically saved to your Supabase database and synced across all devices.
        </p>
      </div>

      {/* CSV Format Help */}
      <details className="mt-3">
        <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
          CSV Format Help
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
          <p className="font-medium mb-2">Expected CSV format:</p>
          <pre className="text-gray-700">
{`Scottie Scheffler
Rory McIlroy
Jon Rahm
...`}
          </pre>
          <p className="mt-2 text-gray-600">
            • One golfer name per line<br/>
            • First column will be used as the golfer name<br/>
            • Header row is optional and will be detected automatically<br/>
            • Empty lines will be ignored
          </p>
        </div>
      </details>
    </div>

    {/* Current golfers count */}
    {golfers.length > 0 && (
      <div className="bg-gray-50 p-3 rounded-lg">
        <h4 className="font-semibold text-gray-700 mb-2">Current Tournament</h4>
        <p className="text-sm text-gray-600">
          {golfers.length} golfers loaded and organized into 6 tiers
        </p>
      </div>
    )}

    {/* Tiers Display */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Object.entries(tiers).map(([tierName, tierGolfers], index) => (
        <div key={tierName} className="bg-gray-50 p-3 sm:p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-gray-700 text-sm sm:text-base">
            Tier {index + 1} ({tierGolfers.length} golfers)
          </h4>
          <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
            {tierGolfers.map((golfer, golferIndex) => (
              <div key={golfer.name} className="text-xs sm:text-sm flex justify-between">
                <span className="truncate mr-2">{golfer.name}</span>
                <span className="text-gray-500 flex-shrink-0">#{(index * 10) + golferIndex + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}